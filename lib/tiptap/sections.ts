import type { EditorDocument } from "@/lib/types";
import { markdownToTiptap, tiptapToMarkdown } from "@/lib/knowledge/markdown";

export class SectionNotFoundError extends Error {
  constructor(heading: string) {
    super(`Seção não encontrada: ${heading}`);
    this.name = "SectionNotFoundError";
  }
}

export type OutlineSection = {
  section_id: string;
  heading: string;
  level: number;
  order: number;
  chars: number;
  start: number;
  end: number;
};

function headingText(node: EditorDocument): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(headingText).join("").trim();
}

function isHeading(node: EditorDocument | undefined): boolean {
  return node?.type === "heading";
}

function headingLevel(node: EditorDocument): number {
  const level = Number(node.attrs?.level ?? 1);
  return Number.isFinite(level) && level > 0 ? level : 1;
}

export function slugHeading(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "secao";
}

export function outline(doc: EditorDocument | null | undefined): OutlineSection[] {
  const content = doc?.content ?? [];
  const starts: { i: number; level: number; heading: string }[] = [];
  content.forEach((node, i) => {
    if (isHeading(node)) starts.push({ i, level: headingLevel(node), heading: headingText(node) });
  });
  const used = new Map<string, number>();
  return starts.map((item, order) => {
    const next = starts.find((other) => other.i > item.i && other.level <= item.level);
    const end = next ? next.i : content.length;
    const base = slugHeading(item.heading);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const slice = content.slice(item.i, end);
    return {
      section_id: n === 1 ? base : `${base}-${n}`,
      heading: item.heading,
      level: item.level,
      order: order + 1,
      chars: JSON.stringify(slice).length,
      start: item.i,
      end,
    };
  });
}

function findSection(
  items: OutlineSection[],
  spec: { section_id?: string; heading?: string }
): { section: OutlineSection; warning?: string } {
  if (spec.section_id) {
    const hit = items.find((s) => s.section_id === spec.section_id);
    if (!hit) throw new SectionNotFoundError(spec.section_id);
    return { section: hit };
  }
  const heading = spec.heading?.trim() ?? "";
  if (!heading) throw new SectionNotFoundError("");
  const matches = items.filter((s) => s.heading.toLowerCase() === heading.toLowerCase());
  if (!matches.length) throw new SectionNotFoundError(heading);
  const warning = matches.length > 1
    ? `Há ${matches.length} seções "${heading}"; usando a primeira.`
    : undefined;
  return { section: matches[0], warning };
}

export function readSection(
  doc: EditorDocument,
  spec: { section_id?: string; heading?: string }
): { markdown: string; section: OutlineSection; warning?: string } {
  const items = outline(doc);
  const { section, warning } = findSection(items, spec);
  const nodes = (doc.content ?? []).slice(section.start, section.end);
  return {
    markdown: tiptapToMarkdown({ type: "doc", content: nodes }),
    section,
    warning,
  };
}

function bodyNodesFromMarkdown(markdown: string, heading: string, level: number): EditorDocument[] {
  const converted = markdownToTiptap(markdown || "");
  const nodes = [...(converted.content ?? [])];
  const first = nodes[0];
  if (first && isHeading(first) && headingText(first).toLowerCase() === heading.trim().toLowerCase()) {
    return nodes.length ? nodes : [first];
  }
  const headingNode: EditorDocument = {
    type: "heading",
    attrs: { level },
    content: heading.trim() ? [{ type: "text", text: heading.trim() }] : [],
  };
  return [headingNode, ...nodes];
}

export function upsertSection(
  doc: EditorDocument,
  opts: { heading: string; markdown: string; after_heading?: string }
): { doc: EditorDocument; section: OutlineSection; created: boolean; warning?: string } {
  const heading = opts.heading.trim();
  if (!heading) throw new Error("Informe heading");
  const content = [...(doc.content ?? [])];
  const items = outline({ type: "doc", content });
  let warning: string | undefined;
  let existing: OutlineSection | undefined;
  try {
    const found = findSection(items, { heading });
    existing = found.section;
    warning = found.warning;
  } catch (err) {
    if (!(err instanceof SectionNotFoundError)) throw err;
  }
  const level = existing?.level ?? 2;
  const replacement = bodyNodesFromMarkdown(opts.markdown, heading, level);
  if (existing) {
    content.splice(existing.start, existing.end - existing.start, ...replacement);
  } else {
    let insertAt = content.length;
    if (opts.after_heading?.trim()) {
      const after = items.find(
        (s) => s.heading.toLowerCase() === opts.after_heading!.trim().toLowerCase()
      );
      if (after) insertAt = after.end;
    }
    content.splice(insertAt, 0, ...replacement);
  }
  const next: EditorDocument = { type: "doc", content };
  const section = outline(next).find((s) => s.heading.toLowerCase() === heading.toLowerCase());
  if (!section) throw new Error("Falha ao gravar a seção");
  return { doc: next, section, created: !existing, warning };
}

export function appendToDocument(doc: EditorDocument, markdown: string): EditorDocument {
  const nodes = markdownToTiptap(markdown || "").content ?? [];
  return { type: "doc", content: [...(doc.content ?? []), ...nodes] };
}

export function deleteSection(
  doc: EditorDocument,
  heading: string
): { doc: EditorDocument; warning?: string } {
  const items = outline(doc);
  const { section, warning } = findSection(items, { heading });
  const content = [...(doc.content ?? [])];
  content.splice(section.start, section.end - section.start);
  return { doc: { type: "doc", content }, warning };
}

export function headingsDocument(headings: string[], level = 2): EditorDocument {
  const content: EditorDocument[] = [];
  for (const heading of headings) {
    content.push({
      type: "heading",
      attrs: { level },
      content: heading ? [{ type: "text", text: heading }] : [],
    });
    content.push({ type: "paragraph" });
  }
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}
