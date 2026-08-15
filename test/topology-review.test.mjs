import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTopologyReviewPrompt,
  normalizeTopologyReviewResult,
  runMainSessionTopologyReview,
  TOPOLOGY_REVIEW_OUTPUT_SCHEMA
} from "../lib/topology-review.js";

function flowFixture() {
  return {
    id: "review-flow",
    name: "Review flow",
    workflowContent: "# IMMUTABLE WORKFLOW",
    docs: { input: "input/STEP.md", output: "output/STEP.md" },
    nodes: [
      { id: "input", kind: "input", position: { x: 0, y: 0 }, data: { label: "Input", instructions: "# IMMUTABLE INPUT" } },
      { id: "output", kind: "output", position: { x: 240, y: 0 }, data: { label: "Output", instructions: "# IMMUTABLE OUTPUT" } }
    ],
    edges: [{ id: "e1", source: "input", target: "output" }],
    inputs: ["input"],
    outputs: ["output"]
  };
}

test("topology review prompt treats Markdown as immutable context and requests topology only", () => {
  const flow = flowFixture();
  const prompt = buildTopologyReviewPrompt(flow, flow, ["example issue"]);
  assert.match(prompt, /bound to the current main Session/);
  assert.match(prompt, /never return or rewrite it/);
  assert.match(prompt, /IMMUTABLE WORKFLOW/);
  assert.match(prompt, /IF\/ELSE and NOT take exactly one truth input/);
  assert.match(prompt, /example issue/);
  assert.deepEqual(TOPOLOGY_REVIEW_OUTPUT_SCHEMA.required, ["summary", "topology"]);
  assert.equal(TOPOLOGY_REVIEW_OUTPUT_SCHEMA.properties.topology.additionalProperties, false);
});

test("main-session topology review uses the live Session Agent as parent and never creates an isolated Session", async () => {
  const flow = flowFixture();
  const mainAgent = { id: "session-main" };
  let startRequest;
  let disposed = 0;
  const agents = {
    get: (id) => id === "session-main" ? mainAgent : undefined,
    create() {
      assert.fail("topology review must not create an isolated Agent Session");
    }
  };
  const host = {
    agentCtx: {
      agents,
      subagents: {
        list: () => ["spawn", "fork"],
        getProvider: () => ({ capabilities: { outputSchema: true } }),
        async start(provider, request) {
          assert.equal(provider, "fork");
          startRequest = request;
          return {
            id: "topology-review-run",
            result: Promise.resolve({
              stopReason: "completed",
              structured: { summary: "kept", topology: { nodes: flow.nodes, edges: flow.edges, inputs: flow.inputs, outputs: flow.outputs } },
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
  const result = await runMainSessionTopologyReview(host, {
    sessionId: "session-main",
    requestId: "topology-request",
    baseFlow: flow,
    draftFlow: flow
  });
  assert.equal(startRequest.parent, mainAgent);
  assert.equal(startRequest.outputSchema, TOPOLOGY_REVIEW_OUTPUT_SCHEMA);
  assert.equal(result.agent.parentSessionId, "session-main");
  assert.equal(result.topology.id, flow.id);
  assert.equal(disposed, 1);
  assert.equal(host.assistControllers.size, 0);
});

test("topology review normalization rejects incomplete results", () => {
  const flow = flowFixture();
  assert.throws(() => normalizeTopologyReviewResult(flow, { summary: "missing" }), /complete topology/);
  assert.throws(() => normalizeTopologyReviewResult(flow, {
    summary: "missing IO",
    topology: { nodes: flow.nodes, edges: flow.edges }
  }), /omitted inputs or outputs/);
});
