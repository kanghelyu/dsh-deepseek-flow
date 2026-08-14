import { descriptors } from "./typert.descriptors.js";

// DeepSeekFlow Typert Host contribution（包 exports "./typert" 自动被发现）。
export const TYPERT = {
  package: "deepseek-flow",
  face: "host",
  schemas: [],
  invocations: descriptors,
  model: {
    services: [
      {
        description: "Per-session visual workflow persistence plus one-shot Agent logic validation and Markdown optimization.",
        summary: "DeepSeekFlow service.",
        tags: [],
        jsDoc: "/** DeepSeekFlow service. */",
        key: "deepseekFlow",
        exportName: "DeepSeekFlowRemoteService",
        members: [],
        types: []
      }
    ],
    events: [],
    objects: []
  }
};
