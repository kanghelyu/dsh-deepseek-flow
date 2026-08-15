import vm from "node:vm";
import { readFile } from "node:fs/promises";

const identity = (value) => value;
const target = {
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
    ReactCurrentDispatcher: {}, ReactCurrentBatchConfig: {}, ReactCurrentOwner: {},
    ReactDebugCurrentFrame: { getStackAddendum: () => "" }
  },
  Fragment: Symbol("Fragment"),
  Children: { map: () => [], forEach: () => {}, count: () => 0, only: identity, toArray: () => [] },
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  createContext: (value) => ({ _currentValue: value, Provider: identity, Consumer: identity }),
  createRef: () => ({ current: null }),
  forwardRef: identity,
  memo: identity,
  lazy: identity,
  startTransition: (callback) => callback(),
  useCallback: identity,
  useContext: (context) => context?._currentValue,
  useDebugValue: () => {},
  useDeferredValue: identity,
  useEffect: () => {},
  useId: () => "id",
  useImperativeHandle: () => {},
  useInsertionEffect: () => {},
  useLayoutEffect: () => {},
  useMemo: (callback) => callback(),
  useReducer: (_reducer, value) => [value, () => {}],
  useRef: (value) => ({ current: value }),
  useState: (value) => [typeof value === "function" ? value() : value, () => {}],
  useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  useTransition: () => [false, (callback) => callback()],
  version: "18.3.1"
};
const react = new Proxy(target, {
  get(object, key) {
    if (key === "default") return react;
    return key in object ? object[key] : () => undefined;
  }
});
const jsx = (type, props) => ({ type, props });
let exported;
let registeredView;
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  URL,
  Blob,
  navigator: { language: "zh-CN", userAgent: "DeepSeekFlow smoke" },
  document: {
    createElement: () => ({ click() {}, remove() {}, style: {}, dataset: {} }),
    head: { append() {} }
  },
  window: {
    __ModuleLoader__: {
      load(definition) {
        exported = definition.factory((id) => {
          if (id === "react") return react;
          if (id === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: react.Fragment };
          if (id === "react-dom") return { createPortal: identity, flushSync: (callback) => callback() };
          throw new Error(`Unexpected client dependency: ${id}`);
        });
      }
    }
  }
};

vm.runInNewContext(await readFile("lib/client.js", "utf8"), sandbox, { filename: "lib/client.js" });
if (!exported || typeof exported.apply !== "function" || !Array.isArray(exported.inject)) {
  throw new Error("DeepSeekFlow client exports are invalid");
}

const connection = { rpc: { call: async () => ({ ok: true, value: [] }) } };
const locale = { getLocale: () => ({ active: "en" }) };
exported.apply({
  connection,
  locale,
  effect: (setup) => setup(),
  slots: {
    inject: (_name, setup) => setup(),
    register: (_definition, component) => {
      registeredView = component;
      return () => {};
    }
  }
});
if (typeof registeredView !== "function") throw new Error("DeepSeekFlow view was not registered");

const viewTree = registeredView({ connection, sessionId: "smoke", language: "en", locale });
function findComponent(node, name) {
  if (!node || typeof node !== "object") return null;
  if (typeof node.type === "function" && node.type.name === name) return node;
  const children = Array.isArray(node.props?.children) ? node.props.children : [node.props?.children];
  for (const child of children) {
    const match = findComponent(child, name);
    if (match) return match;
  }
  return null;
}
const studioElement = findComponent(viewTree, "Studio");
if (!studioElement) throw new Error("DeepSeekFlow Studio was not rendered by the view");
studioElement.type(studioElement.props);

console.log(JSON.stringify({ ok: true, apply: typeof exported.apply, inject: exported.inject, render: "Studio" }));
