import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBusyBlocks, sanitizeMcpPayload, toDraft7Schema } from "./quick-compat";

test("toDraft7Schema tira $schema, additionalProperties e type union", () => {
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
  assert.equal(out.$schema, undefined);
  assert.equal("additionalProperties" in out, false);
  assert.equal(out.properties.add_to_queue.type, "boolean");
});

test("sanitizeMcpPayload completa destructiveHint em tools de leitura", () => {
  const out = sanitizeMcpPayload({
    jsonrpc: "2.0",
    result: {
      tools: [{
        name: "cortex",
        inputSchema: { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", properties: {} },
        annotations: { title: "Porta", readOnlyHint: true, openWorldHint: false },
      }],
    },
  }) as { result: { tools: { inputSchema: { $schema?: string }; annotations: Record<string, unknown> }[] } };
  const tool = out.result.tools[0];
  assert.equal(tool.inputSchema.$schema, undefined);
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
