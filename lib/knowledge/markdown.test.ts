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

test("tabela GFM vira nodes TipTap e volta com pipes", () => {
  const md = [
    "## Inventário",
    "",
    "| Sistema Operacional | Quantidade |",
    "| --- | --- |",
    "| Windows Server 2022 Standard | 16 |",
    "| Windows Server 2019 Standard | 4 |",
  ].join("\n");
  const doc = markdownToTiptap(md);
  const types = JSON.stringify(doc);
  assert.match(types, /"table"/);
  assert.match(types, /"tableRow"/);
  assert.match(types, /"tableCell"|"tableHeader"/);
  assert.doesNotMatch(types, /Windows Server 2022 Standard 16 Windows Server 2019/);
  const back = tiptapToMarkdown(doc);
  assert.match(back, /\| Sistema Operacional \| Quantidade \|/);
  assert.match(back, /Windows Server 2022 Standard/);
  assert.match(back, /\| 16 \|/);
});
