import assert from "node:assert/strict";
import { test } from "node:test";
import { chunkDocument } from "./chunking";
import type { EditorDocument } from "../types";

test("chunking prefixa título e headingPath", () => {
  const doc: EditorDocument = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Funding" }] },
      { type: "paragraph", content: [{ type: "text", text: "Como maximizar funding do MAP com ACE e tagging." }] },
    ],
  };
  const chunks = chunkDocument("Incentivos MAP", doc);
  assert.ok(chunks.length >= 1);
  assert.match(chunks[0].content, /Incentivos MAP/);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.ok(chunks[0].tokenCount > 0);
});
