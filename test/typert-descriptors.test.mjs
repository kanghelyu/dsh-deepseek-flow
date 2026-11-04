import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { descriptors } from "../lib/typert.descriptors.js";

// The Typert gateway claims an endpoint from two independent sources:
//   1. declarative invocations in `lib/typert.descriptors.js` (plain data, host registry), and
//   2. `@Remote` decorator markers, which live in module-private state of
//      `@deepseek-ai/dsh-typert-protocol`.
// When a plugin resolves its own copy of the protocol package (the normal
// out-of-tree layout), the gateway cannot read source 2, so any method that is
// only decorator-registered silently disappears and answers 404. Issue #8 is
// exactly that failure for `dflow/allFlows`. These tests keep every remote
// method declarable, so the route never depends on module-instance identity.

const indexSource = await readFile(new URL("../lib/index.js", import.meta.url), "utf8");

function decoratorRegisteredMethods() {
  const block = indexSource.match(/registerRemoteMethods\(this, \[([\s\S]*?)\]\);/);
  assert.ok(block, "lib/index.js must keep its registerRemoteMethods(this, [...]) table");
  return [...block[1].matchAll(/\[\s*"([^"]+)",\s*"([^"]+)"\s*\]/g)].map((match) => ({
    implementation: match[1],
    exportName: match[2]
  }));
}

test("every decorator-registered remote method also has a declarative descriptor", () => {
  const decorated = decoratorRegisteredMethods();
  assert.ok(decorated.length >= 18, `expected the full remote table, parsed ${decorated.length}`);
  const declared = new Set(descriptors.map((descriptor) => descriptor.method));
  const missing = decorated.filter((entry) => !declared.has(entry.implementation)).map((entry) => entry.implementation);
  assert.deepEqual(missing, [], "declare these methods in lib/typert.descriptors.js as well");
});

test("the Studio history and switch endpoints are explicit declarative routes", () => {
  const declared = new Set(descriptors.map((descriptor) => descriptor.method));
  assert.ok(declared.has("allFlows"), "dflow/allFlows must be a declarative invocation (issue #8)");
  assert.ok(declared.has("activate"), "dflow/activate must be a declarative invocation");
});

test("descriptors stay unique and wire-complete", () => {
  assert.equal(new Set(descriptors.map((descriptor) => descriptor.id)).size, descriptors.length);
  const assertCodec = (codec, subject) => {
    assert.equal(codec?.mode, "strict", `${subject} must use a strict codec`);
    // DSH >=0.1.6 validates create(); DSH <=0.1.5 validated schema. Both must hold.
    assert.equal(typeof codec?.create, "function", `${subject} needs a create() schema projection`);
    assert.equal(typeof codec.create().safeParse, "function", `${subject} create() must return a zod schema`);
    assert.equal(typeof codec?.schema?.safeParse, "function", `${subject} keeps the legacy zod schema for older loaders`);
  };
  for (const descriptor of descriptors) {
    assert.equal(descriptor.service, "deepseekFlow");
    assert.equal(descriptor.namespace, "dflow");
    assert.deepEqual(descriptor.invocation, { kind: "direct" });
    assert.ok(Array.isArray(descriptor.parameters));
    for (const parameter of descriptor.parameters) {
      assert.equal(typeof parameter.name, "string");
      assert.equal(parameter.name, parameter.wire);
      assert.equal(parameter.source, "json");
      assertCodec(parameter.codec, `${descriptor.id} parameter ${parameter.name}`);
    }
    assertCodec(descriptor.result, `${descriptor.id} result`);
  }
});
