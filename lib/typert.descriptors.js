import { z } from "zod";

// DeepSeekFlow Typert wire descriptors：参数白名单，Gateway 严格校验 args 字段。
// 严格 codec 的契约在 DSH 代际之间变过一次：
//   * ≤0.1.5 的 typert-loader 校验 codec.schema 是 zod v4 schema；
//   * ≥0.1.6（含 0.2.x）改为校验 codec.create() 工厂，旧写法会被拒绝：
//     "invocation ... parameter codec has no create() factory"。
// 两种形状同时提供，一份 descriptor 才能横跨整个支持的 DSH 区间。
const unknown = (typeSymbol) => {
  const create = () => z.unknown();
  return {
    mode: "strict",
    typeSymbol,
    create,
    schema: create()
  };
};
const invocation = (service, namespace, method, parameter, implementation) => ({
  id: `deepseek-flow#${namespace}/${method}`,
  service,
  namespace,
  method,
  ...(implementation === undefined ? {} : { implementation }),
  invocation: { kind: "direct" },
  parameters: (Array.isArray(parameter) ? parameter : parameter === undefined ? [] : [parameter]).map((name) => ({
    name,
    wire: name,
    source: "json",
    codec: unknown(`deepseek-flow/types#${name}`)
  })),
  result: unknown(`deepseek-flow/types#${namespace}.${method}.result`)
});

export const descriptors = [
  invocation("deepseekFlow", "dflow", "list", ["sessionId"]),
  // allFlows / activate 曾经只经 @Remote 装饰器注册：装饰器把标记写进
  // dsh-typert-protocol 模块私有的 WeakMap，插件与宿主解析到两份模块实例时
  // 宿主读不到标记，这两个端点就会 404。声明式 descriptor 是纯数据、走
  // TYPERT registry，不依赖模块实例同一性，因此两者都必须在这里显式登记。
  invocation("deepseekFlow", "dflow", "allFlows", ["sessionId"]),
  invocation("deepseekFlow", "dflow", "activate", "request"),
  invocation("deepseekFlow", "dflow", "get", ["sessionId", "id"]),
  invocation("deepseekFlow", "dflow", "create", "request"),
  invocation("deepseekFlow", "dflow", "put", ["flow", "sessionId"]),
  invocation("deepseekFlow", "dflow", "delete", ["sessionId", "id", "shared"]),
  invocation("deepseekFlow", "dflow", "revisions", ["sessionId"]),
  invocation("deepseekFlow", "dflow", "draftSave", "request"),
  invocation("deepseekFlow", "dflow", "draftGet", ["sessionId", "flowId"]),
  invocation("deepseekFlow", "dflow", "draftClear", ["sessionId", "flowId"]),
  invocation("deepseekFlow", "dflow", "assist", "request"),
  invocation("deepseekFlow", "dflow", "topologyApply", "request"),
  invocation("deepseekFlow", "dflow", "finalizePending", ["sessionId", "id"]),
  invocation("deepseekFlow", "dflow", "topologyFinalize", "request"),
  invocation("deepseekFlow", "dflow", "assistCancel", "request"),
  invocation("deepseekFlow", "dflow", "assistHistory", ["sessionId", "key"]),
  invocation("deepseekFlow", "dflow", "models")
];
