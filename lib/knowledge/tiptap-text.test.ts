import assert from "node:assert/strict";
import { test } from "node:test";
import { collectSections, tiptapToPlainText } from "./tiptap-text";
import type { EditorDocument } from "../types";

const doc: EditorDocument = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "MAP" }] },
    { type: "paragraph", content: [{ type: "text", text: "Programa de aceleração." }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Assess" }] },
    { type: "paragraph", content: [{ type: "text", text: "Inventário e 7R." }] },
  ],
};

test("tiptapToPlainText preserva headings", () => {
  const text = tiptapToPlainText(doc);
  assert.match(text, /MAP/);
  assert.match(text, /Assess/);
  assert.match(text, /7R/);
});

test("collectSections gera headingPath", () => {
  const sections = collectSections(doc);
  assert.ok(sections.some((s) => s.headingPath.includes("MAP")));
  assert.ok(sections.some((s) => s.text.includes("Inventário")));
});
