import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { busyBlocksJson, createActivityShape, jsonSchemaTypeIssues, queuePosition } from "./activity-schemas";

test("schema de create_activity é só string, poucos campos (Quick Action Review)", () => {
  const schema = z.toJSONSchema(createActivityShape) as {
    properties?: Record<string, { type?: unknown; items?: unknown }>;
    required?: string[];
  };
  const issues = jsonSchemaTypeIssues(schema);
  assert.deepEqual(issues, []);
  const props = schema.properties || {};
  assert.ok(Object.keys(props).length <= 8);
  for (const [name, spec] of Object.entries(props)) {
    assert.equal(spec.type, "string", name);
    assert.equal(spec.items, undefined, name);
  }
  assert.deepEqual(schema.required, ["title"]);
  assert.equal(createActivityShape.parse({ title: "x", type: "proposta", extra: true }).title, "x");
});

test("busy_blocks no JSON Schema é string (Quick não renderiza objeto aninhado)", () => {
  const schema = z.toJSONSchema(z.object({ busy_blocks: busyBlocksJson })) as {
    properties?: Record<string, { type?: unknown }>;
  };
  assert.equal(schema.properties?.busy_blocks?.type, "string");
});

test("queuePosition aceita número, string numérica e true", () => {
  assert.equal(queuePosition(1), 1);
  assert.equal(queuePosition("3"), 3);
  assert.equal(queuePosition(true), true);
  assert.equal(queuePosition(false), undefined);
  assert.equal(queuePosition(0), undefined);
});
