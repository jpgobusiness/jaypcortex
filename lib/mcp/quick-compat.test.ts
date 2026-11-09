import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DRAFT7_SCHEMA,
  parseBusyBlocks,
  sanitizeMcpPayload,
  toDraft7Schema,
  asBool,
  asNumber,
  asStringList,
} from "./quick-compat";

test("toDraft7Schema marca Draft 7, tira additionalProperties e type union", () => {
  const out = toDraft7Schema({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    properties: {
      add_to_queue: { type: ["boolean", "number"] },
      nested: {
        type: "object",
        additionalProperties: false,
        properties: { start: { type: "string" } },
      },
    },
  }) as { $schema?: string; additionalProperties?: unknown; properties: { add_to_queue: { type: string } } };
  assert.equal(out.$schema, DRAFT7_SCHEMA);
  assert.equal("additionalProperties" in out, false);
  assert.equal(out.properties.add_to_queue.type, "boolean");
});

test("tools de escrita: cada campo vira string (Action Review)", () => {
  const out = toDraft7Schema(
    {
      type: "object",
      properties: {
        confirm: { type: "boolean" },
        position: { type: "number" },
        ids: { type: "array", items: { type: "string" } },
        name: { type: "string" },
      },
      required: ["name"],
    },
    { stringsOnly: true }
  ) as { $schema: string; properties: Record<string, { type: string; items?: unknown }> };
  assert.equal(out.$schema, DRAFT7_SCHEMA);
  for (const spec of Object.values(out.properties)) {
    assert.equal(spec.type, "string");
    assert.equal(spec.items, undefined);
  }
});

test("sanitizeMcpPayload completa destructiveHint em tools de leitura e tira execution", () => {
  const out = sanitizeMcpPayload({
    jsonrpc: "2.0",
    result: {
      tools: [{
        name: "cortex",
        execution: { taskSupport: "forbidden" },
        inputSchema: { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", properties: {} },
        annotations: { title: "Porta", readOnlyHint: true, openWorldHint: false },
      }],
    },
  }) as { result: { tools: { execution?: unknown; inputSchema: { $schema?: string }; annotations: Record<string, unknown> }[] } };
  const tool = out.result.tools[0];
  assert.equal(tool.inputSchema.$schema, DRAFT7_SCHEMA);
  assert.equal(tool.execution, undefined);
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(tool.annotations.destructiveHint, false);
  assert.equal(tool.annotations.title, undefined);
});

test("parseBusyBlocks aceita array e JSON string", () => {
  const blocks = [{ start: "a", end: "b" }];
  assert.deepEqual(parseBusyBlocks(blocks), blocks);
  assert.deepEqual(parseBusyBlocks(JSON.stringify(blocks)), blocks);
  assert.deepEqual(parseBusyBlocks(undefined), []);
});

test("asBool / asNumber / asStringList aceitam o que o Quick manda como texto", () => {
  assert.equal(asBool("true"), true);
  assert.equal(asBool("1"), true);
  assert.equal(asBool(true), true);
  assert.equal(asBool("false"), false);
  assert.equal(asNumber("3"), 3);
  assert.equal(asNumber(2), 2);
  assert.deepEqual(asStringList('["a","b"]'), ["a", "b"]);
  assert.deepEqual(asStringList("a, b"), ["a", "b"]);
});
