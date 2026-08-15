import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLogicPrompt,
  buildOptimizePrompt,
  buildWorkflowOptimizePrompt,
  cancelAgentAssist,
  normalizeLogicResult,
  normalizeWorkflowOptimizationResult,
  parseAgentJson,
  runAgentAssist
} from "../lib/agent-assistant.js";

function flowFixture() {
  return {
    id: "agent-flow",
    name: "Agent review flow",
    workflowDoc: "WORKFLOW.md",
    workflowContent: "# Workflow\n\nMASTER_ONLY",
    docs: { input: "01-input/STEP.md", output: "02-output/STEP.md" },
    nodes: [
      { id: "input", kind: "input", data: { label: "Input", instructions: "# Input\n\nINPUT_ONLY" } },
      { id: "output", kind: "output", data: { label: "Output", instructions: "# Output\n\nOUTPUT_ONLY" } }
    ],
    edges: [{ id: "e1", source: "input", target: "output" }]
  };
}

test("logic Agent prompt contains every Markdown document and graph edge", () => {
  const prompt = buildLogicPrompt(flowFixture());
  assert.match(prompt, /MASTER_ONLY/);
  assert.match(prompt, /INPUT_ONLY/);
  assert.match(prompt, /OUTPUT_ONLY/);
  assert.match(prompt, /\"source\":\"input\"/);
  assert.match(prompt, /\"logicContract\":\{\"version\":1/);
  assert.match(prompt, /不能只当箭头文字/);
  assert.match(prompt, /不要运行工作流/);
});

test("single-document Agent prompt includes only the selected Markdown content", () => {
  const prompt = buildOptimizePrompt(flowFixture(), "input", "保留标题");
  assert.match(prompt, /INPUT_ONLY/);
  assert.match(prompt, /保留标题/);
  assert.doesNotMatch(prompt, /MASTER_ONLY|OUTPUT_ONLY/);
});

test("whole-workflow optimization prompt includes every document and returns complete replacements", () => {
  const flow = flowFixture();
  const prompt = buildWorkflowOptimizePrompt(flow, "保持标题");
  assert.match(prompt, /MASTER_ONLY/);
  assert.match(prompt, /INPUT_ONLY/);
  assert.match(prompt, /OUTPUT_ONLY/);
  assert.match(prompt, /保持标题/);
  assert.match(prompt, /每个节点文档各一次/);
  const result = normalizeWorkflowOptimizationResult(flow, {
    summary: "done",
    documents: [
      { documentId: "workflow", content: "# Better workflow" },
      { documentId: "input", content: "# Better input" },
      { documentId: "02-output/STEP.md", content: "# Better output" }
    ]
  }, { provider: "spawn" });
  assert.equal(result.mode, "optimize-workflow");
  assert.equal(result.documents.length, 3);
  assert.equal(result.documents[2].documentId, "output");
  assert.throws(() => normalizeWorkflowOptimizationResult(flow, {
    documents: [{ documentId: "workflow", content: "# Incomplete" }]
  }), /omitted workflow documents/);
});

test("Agent JSON parsing accepts fenced output and normalizes clickable document targets", () => {
  const raw = parseAgentJson(undefined, [{
    type: "text",
    text: "```json\n{\"summary\":\"done\",\"findings\":[{\"severity\":\"error\",\"documentId\":\"01-input/STEP.md\",\"message\":\"missing input\",\"suggestion\":\"define it\"}]}\n```"
  }]);
  const result = normalizeLogicResult(flowFixture(), raw, { provider: "spawn", runId: "child" });
  assert.deepEqual(result.summary.counts, { error: 1, warning: 0 });
  assert.equal(result.findings[0].documentId, "input");
  assert.equal(result.findings[0].nodeId, "input");
  assert.equal(result.agent.provider, "spawn");
});

test("manual assist starts a one-shot child Agent, returns its structured result, and disposes it", async () => {
  const parent = { id: "session-a" };
  let startRequest;
  let disposed = 0;
  const host = {
    agentCtx: {
      agents: {
        get: (id) => id === "session-a" ? parent : undefined,
        async create(options) {
          return { agent: { id: `isolated-${options.sessionId}` }, async dispose() { disposed += 1; } };
        }
      },
      subagents: {
        list: () => ["spawn"],
        getProvider: () => ({ capabilities: { outputSchema: true } }),
        async start(provider, request) {
          assert.equal(provider, "spawn");
          startRequest = request;
          return {
            id: "child-agent",
            result: Promise.resolve({
              stopReason: "completed",
              structured: {
                summary: "one warning",
                findings: [{ severity: "warning", documentId: "output", message: "ambiguous", suggestion: "clarify" }]
              },
              output: []
            }),
            async dispose() { disposed += 1; }
          };
        }
      }
    },
    assistantProvider: undefined,
    assistantTimeoutMs: 5_000,
    assistControllers: new Map()
  };
  const result = await runAgentAssist(host, {
    sessionId: "session-a",
    requestId: "request-a",
    flow: flowFixture(),
    mode: "logic"
  });
  assert.match(startRequest.parent.id, /^isolated-dflow-assist-/);
  assert.ok(startRequest.outputSchema);
  assert.match(startRequest.prompt[0].text, /MASTER_ONLY/);
  assert.equal(result.findings[0].documentId, "output");
  assert.equal(result.agent.runId, "child-agent");
  assert.equal(disposed, 2);
  assert.equal(host.assistControllers.size, 0);
});

test("whole-workflow assist uses the dedicated schema and disposes after a complete result", async () => {
  let startRequest;
  let disposed = 0;
  const host = {
    agentCtx: {
      agents: {
        get: () => ({ id: "session-a" }),
        async create(options) {
          return { agent: { id: `isolated-${options.sessionId}` }, async dispose() { disposed += 1; } };
        }
      },
      subagents: {
        list: () => ["spawn"],
        getProvider: () => ({ capabilities: { outputSchema: true } }),
        async start(_provider, request) {
          startRequest = request;
          return {
            id: "workflow-agent",
            result: Promise.resolve({
              stopReason: "completed",
              structured: {
                summary: "optimized",
                documents: [
                  { documentId: "workflow", content: "# Workflow v2" },
                  { documentId: "input", content: "# Input v2" },
                  { documentId: "output", content: "# Output v2" }
                ]
              },
              output: []
            }),
            async dispose() { disposed += 1; }
          };
        }
      }
    },
    assistantProvider: undefined,
    assistantTimeoutMs: 5_000,
    assistControllers: new Map()
  };
  const result = await runAgentAssist(host, {
    sessionId: "session-a",
    requestId: "request-workflow",
    flow: flowFixture(),
    mode: "optimize-workflow"
  });
  assert.match(startRequest.label, /整体优化/);
  assert.equal(startRequest.outputSchema.required[1], "documents");
  assert.equal(result.documents.length, 3);
  assert.equal(disposed, 2);
});

test("cancel aborts the active child Agent and still disposes its run", async () => {
  let disposed = 0;
  const host = {
    agentCtx: {
      agents: {
        get: () => ({ id: "session-a" }),
        async create(options) {
          return { agent: { id: `isolated-${options.sessionId}` }, async dispose() { disposed += 1; } };
        }
      },
      subagents: {
        list: () => ["spawn"],
        getProvider: () => ({ capabilities: { outputSchema: false } }),
        async start(_provider, request) {
          return {
            id: "child-agent",
            result: new Promise((resolve) => request.signal.addEventListener("abort", () => resolve({ stopReason: "aborted", output: [] }), { once: true })),
            async dispose() { disposed += 1; }
          };
        }
      }
    },
    assistantProvider: undefined,
    assistantTimeoutMs: 5_000,
    assistControllers: new Map()
  };
  const pending = runAgentAssist(host, {
    sessionId: "session-a",
    requestId: "request-a",
    flow: flowFixture(),
    mode: "logic"
  });
  await Promise.resolve();
  assert.equal(cancelAgentAssist(host, "session-a", "request-a"), true);
  await assert.rejects(pending, /aborted/);
  assert.equal(disposed, 2);
  assert.equal(host.assistControllers.size, 0);
});
