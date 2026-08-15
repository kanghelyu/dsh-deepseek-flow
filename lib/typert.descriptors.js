import { z } from "zod";

// DeepSeekFlow Typert wire descriptors：参数白名单，Gateway 严格校验 args 字段。
const unknown = (typeSymbol) => ({
  mode: "strict",
  typeSymbol,
  schema: z.unknown()
});
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
  invocation("deepseekFlow", "dflow", "get", ["sessionId", "id"]),
  invocation("deepseekFlow", "dflow", "create", "request"),
  invocation("deepseekFlow", "dflow", "put", ["flow", "sessionId"]),
  invocation("deepseekFlow", "dflow", "delete", ["sessionId", "id"]),
  invocation("deepseekFlow", "dflow", "assist", "request"),
  invocation("deepseekFlow", "dflow", "topologyApply", "request"),
  invocation("deepseekFlow", "dflow", "assistCancel", "request"),
  invocation("deepseekFlow", "dflow", "assistHistory", ["sessionId"]),
  invocation("deepseekFlow", "dflow", "models")
];
