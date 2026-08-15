import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientSources = await Promise.all([
  "../src/client/entry.js",
  "../src/client/graph-canvas.js",
  "../src/client/graph-model.js",
  "../src/client/i18n.js",
  "../src/client/styles.js"
].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
const client = clientSources.join("\n");
const host = await readFile(new URL("../lib/index.js", import.meta.url), "utf8");
const descriptors = await readFile(new URL("../lib/typert.descriptors.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");
const ensureDeps = await readFile(new URL("../scripts/ensure-deps.sh", import.meta.url), "utf8");
const workspaceConfig = await readFile(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("both side panels resize from their edges and collapse below a threshold", () => {
  assert.match(client, /documentsOpen/);
  assert.match(client, /inspectorOpen/);
  assert.match(client, /beginPanelResize/);
  assert.match(client, /PANEL_COLLAPSE_THRESHOLD\s*=\s*108/);
  assert.match(client, /df-splitter--left/);
  assert.match(client, /df-splitter--right/);
  assert.match(client, /role:\s*"separator"/);
  assert.match(client, /gridTemplateColumns/);
  assert.doesNotMatch(client, /@media\(max-width:760px\)\{\.df-inspector\{display:none/);
});

test("every flow box owns exactly one left and one right handle and every edge has a closed arrow", () => {
  assert.equal((client.match(/className: "df-graph__handle df-graph__handle--/g) ?? []).length, 2);
  assert.match(client, /df-graph__handle--target/);
  assert.match(client, /df-graph__handle--source/);
  assert.match(client, /markerEnd: `url\(#\$\{markerIdRef\.current\}\)`/);
  assert.match(client, /M 0 0 L 10 5 L 0 10 Z/);
  assert.match(client, /onConnect/);
  assert.match(client, /connectHint/);
  assert.doesNotMatch(client, /React\.createElement\(Handle|Position\.Left|Position\.Right/);
});

test("condition boxes choose a gate first and enforce labeled outgoing branches", () => {
  assert.match(client, /gatePickerOpen/);
  assert.match(client, /pendingConnection/);
  assert.match(client, /connectionWarning/);
  assert.match(client, /CONDITION_GATE_TYPES\.map/);
  for (const gate of ["nand", "nor", "xor", "xnor"]) assert.match(client, new RegExp(`${gate}:`));
  assert.match(client, /"data-df-gate-type": gateType/);
  assert.match(client, /"data-df-branch": branch/);
  assert.match(client, /conditionConnection|connectionProblem/);
  assert.match(client, /availableGateBranches/);
  assert.match(client, /validateGateBranch/);
  assert.match(client, /if \(gateType === "ifElse"\)/);
  assert.match(client, /commitConnection\(conn, gateType\)/);
  assert.match(client, /selectedConditionInputs/);
  assert.match(client, /selectedGateArityValid/);
  assert.match(client, /gateRule\(selectedNode\.data\.gateType\)/);
  assert.match(client, /inputPredicates/);
  assert.match(client, /t\.logicInputs/);
  assert.match(client, /onConnectionRejected/);
  assert.match(client, /gateChangeBlocked/);
  assert.match(client, /autoLogicLabel/);
  assert.match(client, /sourceHandle: branch/);
  assert.match(client, /t\.gateTypeLabel/);
});

test("arrows stay prominent across themes, never fill, and long flows can fit", () => {
  assert.match(client, /markerWidth:\s*10/);
  assert.match(client, /markerHeight:\s*10/);
  assert.match(client, /fill: "var\(--df-brand\)"/);
  assert.match(client, /fill:none!important/);
  assert.match(client, /stroke-width:2\.6/);
  assert.match(client, /GRAPH_MIN_ZOOM\s*=\s*0\.5/);
  assert.match(client, /minZoom:\s*GRAPH_MIN_ZOOM/);
  assert.match(client, /fitAll/);
  assert.match(client, /}, 600\)/);
  assert.doesNotMatch(client, /react-flow__/);
});

test("Flow view hides only the current Harness composer and restores it on unmount", () => {
  assert.match(client, /useLayoutEffect/);
  assert.match(client, /closest\?\.\("\[data-conversation-scroll\]"\)/);
  assert.match(client, /:scope > \[data-composer-seat\]/);
  assert.match(client, /data-deepseek-flow-immersive/);
  assert.match(client, /composerSeat\.inert = true/);
  assert.match(client, /removeAttribute\("data-deepseek-flow-immersive"\)/);
  assert.match(client, /composerSeat\.inert = previousInert/);
});

test("client visual colors use host theme tokens instead of fixed literals", () => {
  assert.match(client, /--dsw-alias-brand-primary/);
  assert.doesNotMatch(client, /#[0-9a-fA-F]{3,8}|rgba?\(/);
});

test("DeepSeekFlow has no run surface or host execution endpoint", () => {
  for (const source of [client, host, descriptors]) {
    assert.doesNotMatch(source, /dflow\/run/);
    assert.doesNotMatch(source, /dflow\/runs/);
    assert.doesNotMatch(source, /workflowEngine/);
  }
  assert.doesNotMatch(host, /name:\s*"flow_runs"/);
  assert.doesNotMatch(client, /className:\s*"df-actionbar"/);
});

test("current Session can read the complete flow and evaluate gates without running Agent steps", () => {
  assert.match(host, /name:\s*"flow_read"/);
  assert.match(host, /name:\s*"flow_evaluate"/);
  assert.match(host, /workflowContent/);
  assert.match(host, /orderedNodeIds\(flow\)/);
  assert.match(host, /Use logicContract or flow_evaluate/);
  assert.match(host, /evaluateFlowLogic\(stored, args\.values\)/);
});

test("bottom assistant manually delegates validation and optimization to a one-shot Agent", () => {
  assert.match(client, /df-assistant/);
  assert.match(client, /dflow\/assist/);
  assert.match(client, /runLogicValidation/);
  assert.match(client, /runDocumentOptimization/);
  assert.match(client, /runWorkflowOptimization/);
  assert.match(client, /topologyDirty && assistantBusy !== "logic" \? " is-disabled" : ""/);
  assert.match(client, /topologyDirty && assistantBusy !== "optimize-workflow" \? " is-disabled" : ""/);
  assert.match(client, /setCancelConfirm\(\{ mode: "logic" \}\)/);
  assert.match(client, /setCancelConfirm\(\{ mode: "document" \}\)/);
  assert.match(client, /setCancelConfirm\(\{ mode: "workflow" \}\)/);
  assert.match(client, /cancelConfirm\.mode === "logic" \? t\.cancelConfirmLogic/);
  assert.match(client, /"data-df-action": "confirm-cancel-agent"/);
  assert.match(client, /"data-df-action": "wait-cancel"/);
  assert.match(client, /t\.cancelValidation/);
  assert.match(client, /entry\.status === "cancelled"/);
  assert.doesNotMatch(client, /"data-df-action": "cancel-agent"/);
  assert.doesNotMatch(client, /onClick: runDocumentOptimization/);
  assert.match(client, /"data-df-action": "logic-validation"/);
  assert.match(client, /"data-df-action": "optimize-document"/);
  assert.match(client, /"data-df-action": "optimize-workflow"/);
  assert.match(client, /"data-df-action": "confirm-optimize-workflow"/);
  assert.match(client, /acceptOptimization/);
  assert.match(client, /discardOptimization/);
  assert.match(client, /logicSnapshot/);
  assert.match(client, /staleSuggestion/);
  assert.match(client, /sessionId, requestId, flow, mode: "logic"/);
  assert.match(client, /sessionId, requestId: agentRequestId, flow, mode: "optimize"/);
  assert.doesNotMatch(client, /Manual only|全程手动/);
  assert.doesNotMatch(client, /runAssistant\("debug"\)|staticDebug|Static debug|静态 Debug/);
  assert.doesNotMatch(client, /copyForSession|copySession/);
  assert.equal((client.match(/remoteCall\(connection, "dflow\/assist"/g) ?? []).length, 3);
  assert.match(client, /mode: "optimize-workflow"/);
  assert.match(client, /const optimizedFlow =/);
  assert.match(client, /mergeDocumentEdits\(persistedFlowRef\.current, optimizedFlow/);
  assert.match(client, /const persistedRevision = persistedRevisionRef\.current\.get\(documentOnly\.id\)/);
  assert.match(client, /remoteCall\(connection, "dflow\/put", \{ flow: payload, sessionId \}\)/);
  assert.match(client, /remoteCall\(connection, "dflow\/assistCancel"/);
  assert.match(client, /flex:none/);
  assert.match(client, /beginAssistantResize/);
  assert.match(client, /ASSISTANT_COLLAPSE_THRESHOLD/);
  assert.match(client, /df-assistant-splitter/);
  assert.match(host, /runAgentAssist/);
  assert.match(host, /ctx\.inject\(\["agents", "subagents"\]/);
  assert.match(host, /cancelAgentAssist/);
  assert.doesNotMatch(host, /optimizeWorkflowDocument|reviewWorkflow/);
  assert.match(host, /Unsupported dflow\/assist mode/);
  assert.match(host, /"optimize-workflow"/);
  assert.match(host, /assistantTimeoutMs[\s\S]{0,400}: null/);
});

test("document navigation centers nodes with a slow interruptible animation", () => {
  assert.match(client, /focusNode/);
  assert.match(client, /flowInstance\?\.focusNode\?\.\(id, \{ duration: 720 \}\)/);
  assert.match(client, /requestAnimationFrame\(tick\)/);
  assert.match(client, /1 - Math\.pow\(1 - progress, 4\)/);
  assert.match(client, /cancelViewportAnimation/);
});

test("assistant columns keep findings and full Markdown independently scrollable", () => {
  assert.match(client, /\.df-docrail__list\{flex:1 1 0;height:0;min-height:0;overflow:auto/);
  assert.match(client, /\.df-findings\{flex:1 1 0;height:0;min-height:0;overflow:auto/);
  assert.match(client, /\.df-assistant__preview-head\{position:sticky/);
  assert.match(client, /\.df-assistant__preview textarea\{flex:1;min-height:0;resize:none;overflow:auto/);
  assert.match(client, /\.df-assistant\.is-open\{max-height:min\(440px,54%\)\}/);
  assert.match(client, /proposalPending/);
});

test("unused top-level New button is removed while flow-box creation remains", () => {
  assert.doesNotMatch(client, /onClick: newFlow/);
  assert.doesNotMatch(client, /const newFlow = async/);
  assert.match(client, /const addBar/);
  assert.match(client, /onClick: \(\) => addNode\(kind\)/);
});

test("Error and Warn counters are real toggle filters", () => {
  assert.match(client, /React\.createElement\("button", \{\s*key: "error"/);
  assert.match(client, /React\.createElement\("button", \{\s*key: "warning"/);
  assert.match(client, /"data-df-filter": "error"/);
  assert.match(client, /"data-df-filter": "warning"/);
  assert.match(client, /setFindingFilter\(\(value\) => value === "error" \? null : "error"\)/);
  assert.match(client, /visibleFindings\.map/);
  assert.match(client, /aria-pressed/);
  assert.doesNotMatch(client, /setAssistantResult/);
});

test("client manifest mirrors services and slot packages actually consumed", () => {
  assert.deepEqual(manifest.dsh.client.inject, [
    "@deepseek-ai/dsh-client-connection",
    "@deepseek-ai/dsh-client-locale",
    "@deepseek-ai/dsh-client-ui-conversation",
    "@deepseek-ai/dsh-client-ui-slots"
  ]);
  assert.deepEqual(JSON.parse(client.match(/const inject = (\[[^;]+\])/)[1]), ["slots", "connection", "locale"]);
  assert.match(client, /ctx\.slots\.inject\("conversation\.view"/);
  assert.ok(manifest.files.includes("lib"));
  assert.ok(manifest.files.includes("src"));
  assert.ok(manifest.exports["./client"]);
});

test("DeepSeekFlow exposes only workflow tools and does not own unrelated vision execution", () => {
  assert.doesNotMatch(host, /vision_describe|vision\.py|execFile/);
  assert.match(host, /name:\s*"flow_create"/);
  assert.match(host, /name:\s*"flow_read"/);
});

test("editor convenience includes undo redo, validation, layout, pan and zoom without a minimap", () => {
  assert.match(client, /undoGraph/);
  assert.match(client, /redoGraph/);
  assert.match(client, /reconnectFlowEdge/);
  assert.match(client, /isValidConnection/);
  assert.match(client, /layoutNodes/);
  assert.match(client, /beginPan/);
  assert.match(client, /zoomAtCenter/);
  assert.match(client, /screenToWorld/);
  assert.doesNotMatch(client, /MiniMap|ReactFlow|@xyflow\/react/);
});

test("client build carries a visible content revision for cache diagnosis", () => {
  assert.match(client, /CLIENT_REV/);
  assert.match(client, /df-titlebar__rev/);
  assert.match(build, /createHash\("sha256"\)/);
  assert.match(build, /lib\/client\.rev/);
  assert.match(build, /replaceAll\("__DEEPSEEK_FLOW_CLIENT_REV__"/);
  assert.match(build, /wrapped = wrapped\.replace\([^\n]*client-rev/);
  assert.match(build, /dependency-free offline wrapper/);
});

test("Studio serializes autosaves while carrying the latest persisted revision", () => {
  assert.match(client, /persistedRevisionRef/);
  assert.match(client, /\{ \.\.\.documentOnly, revision: persistedRevision \}/);
  assert.match(client, /persistedRevisionRef\.current\.set\(saved\.id/);
  assert.match(host, /nextFlowRevision/);
  assert.match(host, /documentPolicy: "prefer-flow"/);
  assert.match(host, /archiveObsoleteDocuments/);
});

test("topology edits require an explicit bottom-right main-Session review before persistence", () => {
  assert.match(client, /topologyDirty/);
  assert.match(client, /df-topology-apply/);
  assert.match(client, /"data-df-action": "apply-topology"/);
  assert.match(client, /"data-df-action": "confirm-apply-topology"/);
  assert.match(client, /dflow\/topologyApply/);
  assert.match(client, /mergeDocumentEdits/);
  assert.match(client, /baseTopology: topologyProjection\(baseFlow\)/);
  assert.match(client, /topologyApplyFailed/);
  assert.match(client, /df-canvas-stage/);
  assert.match(host, /runMainSessionTopologyReview/);
  assert.match(host, /topologySignature\(latestBase\) !== topologySignature\(baseTopology\)/);
  assert.match(host, /validateFlow\(rebuilt\)/);
  assert.match(descriptors, /"topologyApply"/);
});

test("dependency repair prefers registry packages, falls back to DSH, and refuses live-web mutation", () => {
  assert.match(ensureDeps, /DSH_NODE_MODULES/);
  assert.match(ensureDeps, /node_modules\/@deepseek-ai/);
  assert.match(ensureDeps, /missing @deepseek-ai\/\$package_name after pnpm install/);
  assert.match(ensureDeps, /127\.0\.0\.1:3080/);
  assert.match(ensureDeps, /refusing to mutate node_modules/);
  assert.match(ensureDeps, /host \+ typert imports: ok/);
  assert.doesNotMatch(ensureDeps, /\brm\s+-/);
  assert.match(workspaceConfig, /^autoInstallPeers:\s*false/m);
  assert.match(workspaceConfig, /allowBuilds:\s*\n\s+esbuild:\s*true/);
  assert.ok(!Object.hasOwn(manifest.dependencies, "@xyflow/react"));
});

test("tools resolve the current Session from agent id or nested session only", () => {
  assert.match(host, /const sid = agent\.id \?\? agent\.session\?\.id/);
  assert.doesNotMatch(host, /agent\.sessionId/);
});
