import assert from "node:assert/strict";
import { test } from "node:test";
import type { EditorDocument } from "@/lib/types";
import {
  appendToDocument,
  deleteSection,
  headingsDocument,
  outline,
  readSection,
  SectionNotFoundError,
  upsertSection,
} from "./sections";

function text(value: string): EditorDocument {
  return { type: "text", text: value };
}

function heading(level: number, value: string): EditorDocument {
  return { type: "heading", attrs: { level }, content: [text(value)] };
}

function paragraph(value: string): EditorDocument {
  return { type: "paragraph", content: [text(value)] };
}

function tableDoc(): EditorDocument {
  return {
    type: "table",
    content: [{
      type: "tableRow",
      content: [
        { type: "tableCell", content: [{ type: "paragraph", content: [text("col-a")] }] },
        { type: "tableCell", content: [{ type: "paragraph", content: [text("col-b")] }] },
      ],
    }],
  };
}

const sample: EditorDocument = {
  type: "doc",
  content: [
    heading(2, "Resumo executivo"),
    paragraph("texto do resumo"),
    heading(2, "Escopo"),
    paragraph("corpo do escopo"),
    {
      type: "bulletList",
      content: [{ type: "listItem", content: [paragraph("item da lista")] }],
    },
    heading(2, "Investimento"),
    tableDoc(),
    heading(2, "Riscos"),
    { type: "codeBlock", attrs: { language: "sql" }, content: [text("SELECT 1")] },
  ],
};

test("outline fatiar até o próximo heading do mesmo nível", () => {
  const items = outline(sample);
  assert.equal(items.length, 4);
  assert.equal(items[1].heading, "Escopo");
  assert.equal(items[1].section_id, "escopo");
  const escopo = sample.content!.slice(items[1].start, items[1].end);
  assert.equal(escopo[0].type, "heading");
  assert.ok(escopo.some((n) => n.type === "bulletList"));
  assert.equal(escopo.some((n) => n.type === "table"), false);
});

test("tabela em outra seção permanece após upsert", () => {
  const result = upsertSection(sample, { heading: "Escopo", markdown: "novo escopo com **negrito**" });
  const items = outline(result.doc);
  const investimento = items.find((s) => s.heading === "Investimento")!;
  const slice = result.doc.content!.slice(investimento.start, investimento.end);
  assert.ok(slice.some((n) => n.type === "table"));
  const table = JSON.stringify(slice);
  assert.match(table, /col-a/);
  assert.match(table, /col-b/);
  const escopo = readSection(result.doc, { heading: "Escopo" });
  assert.match(escopo.markdown, /novo escopo/i);
  assert.doesNotMatch(escopo.markdown, /col-a/);
});

test("lista permanece na seção vizinha", () => {
  const result = upsertSection(sample, { heading: "Resumo executivo", markdown: "resumo novo" });
  const escopo = readSection(result.doc, { heading: "Escopo" });
  assert.match(escopo.markdown, /item da lista/);
});

test("code block permanece após upsert de outra seção", () => {
  const result = upsertSection(sample, { heading: "Escopo", markdown: "escopo 2" });
  const riscos = readSection(result.doc, { heading: "Riscos" });
  assert.match(riscos.markdown, /SELECT 1/);
});

test("seção inexistente: read lança; upsert cria", () => {
  assert.throws(() => readSection(sample, { heading: "Não existe" }), SectionNotFoundError);
  const created = upsertSection(sample, { heading: "Fora de escopo", markdown: "fica de fora", after_heading: "Escopo" });
  assert.equal(created.created, true);
  const items = outline(created.doc);
  const escopo = items.find((s) => s.heading === "Escopo")!;
  const fora = items.find((s) => s.heading === "Fora de escopo")!;
  assert.equal(fora.order, escopo.order + 1);
  assert.match(readSection(created.doc, { heading: "Fora de escopo" }).markdown, /fica de fora/);
});

test("headings duplicados usam o primeiro e avisam", () => {
  const dup: EditorDocument = {
    type: "doc",
    content: [
      heading(2, "Escopo"),
      paragraph("primeiro"),
      heading(2, "Escopo"),
      paragraph("segundo"),
    ],
  };
  const items = outline(dup);
  assert.equal(items[0].section_id, "escopo");
  assert.equal(items[1].section_id, "escopo-2");
  const read = readSection(dup, { heading: "Escopo" });
  assert.match(read.warning ?? "", /2 seções/);
  assert.match(read.markdown, /primeiro/);
  assert.doesNotMatch(read.markdown, /segundo/);
  const updated = upsertSection(dup, { heading: "Escopo", markdown: "só o primeiro muda" });
  assert.match(updated.warning ?? "", /2 seções/);
  assert.match(readSection(updated.doc, { section_id: "escopo" }).markdown, /só o primeiro muda/);
  assert.match(readSection(updated.doc, { section_id: "escopo-2" }).markdown, /segundo/);
});

test("append e delete de seção", () => {
  const appended = appendToDocument(sample, "## Extra\n\nnota final");
  assert.ok(outline(appended).some((s) => s.heading === "Extra"));
  const removed = deleteSection(appended, "Extra");
  assert.equal(outline(removed.doc).some((s) => s.heading === "Extra"), false);
  assert.ok(outline(removed.doc).some((s) => s.heading === "Riscos"));
});

test("delete_section de heading inexistente não altera o doc", () => {
  assert.throws(() => deleteSection(sample, "Fora de escopo"), SectionNotFoundError);
  assert.deepEqual(outline(sample).map((s) => s.heading), outline(sample).map((s) => s.heading));
  const withFora = upsertSection(sample, { heading: "Fora de escopo", markdown: "fica de fora" });
  const after = deleteSection(withFora.doc, "Fora de escopo");
  assert.equal(outline(after.doc).some((s) => s.heading === "Fora de escopo"), false);
  assert.ok(outline(after.doc).some((s) => s.heading === "Escopo"));
  assert.ok(outline(after.doc).some((s) => s.heading === "Riscos"));
});

test("headingsDocument gera H2 vazios", () => {
  const doc = headingsDocument(["Cliente", "Dor"]);
  const items = outline(doc);
  assert.deepEqual(items.map((s) => s.heading), ["Cliente", "Dor"]);
});
