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
    return key in object ? object[key] : () => undefined;
  }
});
const jsx = (type, props) => ({ type, props });
let exported;
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  URL,
  Blob,
  navigator: { language: "zh-CN", userAgent: "DeepSeekFlow smoke" },
  document: {
    createElement: () => ({ click() {}, remove() {}, style: {} }),
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
console.log(JSON.stringify({ ok: true, apply: typeof exported.apply, inject: exported.inject }));
