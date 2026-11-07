import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { createActivityShape, jsonSchemaTypeIssues, queuePosition } from "./activity-schemas";

test("schema de create_activity não usa union de tipos (Quick Action Review)", () => {
  const schema = z.toJSONSchema(createActivityShape) as { properties?: Record<string, { type?: unknown }> };
  const issues = jsonSchemaTypeIssues(schema);
  assert.deepEqual(issues, []);
  assert.equal(schema.properties?.add_to_queue?.type, "number");
});

test("queuePosition aceita número, string numérica e true", () => {
  assert.equal(queuePosition(1), 1);
  assert.equal(queuePosition("3"), 3);
  assert.equal(queuePosition(true), true);
  assert.equal(queuePosition(false), undefined);
  assert.equal(queuePosition(0), undefined);
});
