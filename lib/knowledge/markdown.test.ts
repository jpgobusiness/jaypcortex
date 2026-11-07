import assert from "node:assert/strict";
import { test } from "node:test";
import { markdownToTiptap, tiptapToMarkdown } from "./markdown";

test("markdown → tiptap é um doc", () => {
  const doc = markdownToTiptap("# Título\n\nParágrafo com **negrito**.");
  assert.equal(doc.type, "doc");
  assert.ok((doc.content?.length ?? 0) > 0);
});

test("ida e volta preserva heading e parágrafo", () => {
  const md = "# MAP\n\nTexto de funding.";
  const back = tiptapToMarkdown(markdownToTiptap(md));
  assert.match(back, /MAP/);
  assert.match(back, /funding/);
});
