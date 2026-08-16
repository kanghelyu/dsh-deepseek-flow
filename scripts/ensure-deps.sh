#!/usr/bin/env bash
set -euo pipefail

plugin_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$plugin_root"

mode="${1:-ensure}"
if [[ "$mode" != "ensure" && "$mode" != "--check-only" ]]; then
  echo "usage: bash scripts/ensure-deps.sh [--check-only]" >&2
  exit 2
fi

host_packages=(
  dsh-tools
  dsh-typert-protocol
)
registry_paths=(
  node_modules/esbuild/package.json
  node_modules/playwright/package.json
  node_modules/zod/package.json
)

find_dsh_node_modules() {
  local candidate
  if [[ -n "${DSH_NODE_MODULES:-}" && -d "$DSH_NODE_MODULES" ]]; then
    printf '%s\n' "$DSH_NODE_MODULES"
    return 0
  fi
  if command -v npm >/dev/null 2>&1; then
    candidate="$(npm root -g 2>/dev/null || true)/@deepseek-ai/dsh/node_modules"
    if [[ -d "$candidate/@deepseek-ai" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi
  shopt -s nullglob
  for candidate in "$HOME"/.nvm/versions/node/*/lib/node_modules/@deepseek-ai/dsh/node_modules; do
    if [[ -d "$candidate/@deepseek-ai" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

dsh_node_modules="$(find_dsh_node_modules || true)"

# 防御：dsh-tools 是宿主运行时包（peerDependency），绝不允许嵌套实体副本存在。
# 旧版按 dependencies 安装会留下实体副本，与 DSH 宿主内的正副本形成两个模块实例：
# dsh-tools 用模块级局部 Symbol (TOOL_RUNTIME_SCHEDULER) 注册调度器，双实例时
# Symbol 不同 → registry[Symbol] 为 undefined → 宿主全部工具调用崩溃。
# 本脚本遵循「不删除」契约：只检测、拒绝继续，并给出精确的手动清理指引。
nested_tools_link="node_modules/@deepseek-ai/dsh-tools"
if [[ -d node_modules/.pnpm ]] && ls node_modules/.pnpm/@deepseek-ai+dsh-tools@* >/dev/null 2>&1; then
  echo "[deepseek-flow] nested dsh-tools copy found in node_modules/.pnpm — this creates a duplicate module instance and breaks ALL host tool calls." >&2
  echo "Fix: remove the store entry and the stale link, then rerun this script:" >&2
  echo "  ${plugin_root}/node_modules/.pnpm/@deepseek-ai+dsh-tools@*" >&2
  echo "  ${plugin_root}/${nested_tools_link}" >&2
  exit 1
fi
if [[ -e "$nested_tools_link" && ! -L "$nested_tools_link" ]]; then
  echo "[deepseek-flow] dsh-tools exists as a real directory (not a host symlink) — duplicate module instance breaks ALL host tool calls." >&2
  echo "Fix: remove it, then rerun this script:" >&2
  echo "  ${plugin_root}/${nested_tools_link}" >&2
  exit 1
fi
if [[ -L "$nested_tools_link" ]]; then
  real_target="$(readlink "$nested_tools_link")"
  if [[ "$real_target" != "$dsh_node_modules/@deepseek-ai/dsh-tools" ]]; then
    echo "[deepseek-flow] dsh-tools symlink points to $real_target (expected the DSH host copy). Duplicate instance risk." >&2
    echo "Fix: remove the stale link, then rerun this script:" >&2
    echo "  ${plugin_root}/${nested_tools_link}" >&2
    exit 1
  fi
fi

needs_mutation=0
for path in "${registry_paths[@]}"; do
  [[ -f "$path" ]] || needs_mutation=1
done
for package_name in "${host_packages[@]}"; do
  [[ -e "node_modules/@deepseek-ai/$package_name" ]] || needs_mutation=1
done

if [[ "$mode" == "--check-only" ]]; then
  if [[ "$needs_mutation" -ne 0 ]]; then
    echo "[deepseek-flow] dependencies need repair; stop dsh web, then run without --check-only." >&2
    exit 1
  fi
else
  if [[ "$needs_mutation" -ne 0 ]] && command -v curl >/dev/null 2>&1 && curl -fsS --max-time 1 http://127.0.0.1:3080 >/dev/null 2>&1; then
    echo "[deepseek-flow] dsh web is running on :3080; refusing to mutate node_modules." >&2
    echo "Stop dsh web, rerun this script, then restart web." >&2
    exit 1
  fi

  missing_registry=0
  for path in "${registry_paths[@]}"; do
    [[ -f "$path" ]] || missing_registry=1
  done
  missing_host=0
  for package_name in "${host_packages[@]}"; do
    [[ -e "node_modules/@deepseek-ai/$package_name" ]] || missing_host=1
  done
  if [[ "$missing_registry" -ne 0 || "$missing_host" -ne 0 ]]; then
    command -v pnpm >/dev/null 2>&1 || {
      echo "[deepseek-flow] pnpm is required to install registry packages." >&2
      exit 1
    }
    pnpm install --frozen-lockfile
  fi

  mkdir -p node_modules/@deepseek-ai
  for package_name in "${host_packages[@]}"; do
    link="node_modules/@deepseek-ai/$package_name"
    target="${dsh_node_modules:+$dsh_node_modules/@deepseek-ai/$package_name}"
    if [[ ! -e "$link" && -n "$target" && -e "$target" ]]; then
      ln -s "$target" "$link"
    fi
    [[ -e "$link" ]] || {
      echo "[deepseek-flow] missing @deepseek-ai/$package_name after pnpm install and no global DSH fallback was found." >&2
      exit 1
    }
  done

  if [[ ! -f node_modules/zod/package.json && -n "$dsh_node_modules" && -f "$dsh_node_modules/zod/package.json" ]]; then
    ln -s "$dsh_node_modules/zod" node_modules/zod
  fi
fi

node --input-type=module -e '
  const modules = await Promise.all([import("./lib/index.js"), import("./lib/typert.host.js")]);
  if (typeof modules[0].apply !== "function" || !modules[1].TYPERT) throw new Error("host/typert exports are invalid");
  console.log("[deepseek-flow] host + typert imports: ok");
'
node scripts/client-smoke.mjs
echo "[deepseek-flow] dependency verification: ok"
