import assert from "node:assert/strict";
import test from "node:test";
import {
  optionalJsonArray,
  optionalJsonObject,
  requiredJsonObject
} from "../lib/tool-arguments.js";

test("tool arguments accept native JSON values and Web GUI JSON strings", () => {
  assert.deepEqual(optionalJsonArray({ steps: [{ id: "work" }] }, "steps"), [{ id: "work" }]);
  assert.deepEqual(optionalJsonArray({ steps: '[{"id":"work"}]' }, "steps"), [{ id: "work" }]);
  assert.deepEqual(requiredJsonObject({ values: { work: true } }, "values"), { work: true });
  assert.deepEqual(requiredJsonObject({ values: '{"work":true}' }, "values"), { work: true });
  assert.deepEqual(optionalJsonObject({ flow: '{"id":"flow"}' }, "flow"), { id: "flow" });
  assert.equal(optionalJsonArray({}, "steps"), undefined);
});

test("tool arguments reject malformed JSON and incorrect parameter shapes", () => {
  assert.throws(() => optionalJsonArray({ steps: "not json" }, "steps"), /steps must be valid JSON/);
  assert.throws(() => optionalJsonArray({ steps: "{}" }, "steps"), /steps must be a JSON array/);
  assert.throws(() => requiredJsonObject({ values: "[]" }, "values"), /values must be a JSON object/);
  assert.throws(() => optionalJsonObject({ flow: "null" }, "flow"), /flow must be a JSON object/);
});
