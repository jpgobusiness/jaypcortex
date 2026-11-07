import type { EditorDocument } from "@/lib/types";

type WalkOpts = {
  headingPath: string[];
};

export type TextSection = {
  headingPath: string;
  text: string;
};

function nodeType(node: EditorDocument | undefined): string {
  return node?.type ?? "";
}

export function tiptapToPlainText(doc: EditorDocument | null | undefined): string {
  if (!doc) return "";
  return collectSections(doc)
    .map((s) => (s.headingPath ? `## ${s.headingPath}\n${s.text}` : s.text))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function collectSections(doc: EditorDocument): TextSection[] {
  const sections: TextSection[] = [];
  const headings: string[] = [];
  let buffer: string[] = [];

  function flush() {
    const text = buffer.join("\n").trim();
    if (text) {
      sections.push({ headingPath: headings.join(" > "), text });
    }
    buffer = [];
  }

  function walk(node: EditorDocument, opts: WalkOpts) {
    const type = nodeType(node);
    if (type === "heading") {
      flush();
      const level = Number(node.attrs?.level ?? 1);
      const title = inlineText(node);
      headings.splice(level - 1);
      headings[level - 1] = title;
      headings.length = level;
      return;
    }
    if (type === "text" && node.text) {
      buffer.push(node.text);
      return;
    }
    if (type === "hardBreak" || type === "paragraph" || type === "listItem" || type === "taskItem" || type === "blockquote") {
      node.content?.forEach((child) => walk(child, opts));
      buffer.push("\n");
      return;
    }
    if (type === "codeBlock") {
      buffer.push("\n```\n" + (node.content?.map((c) => c.text ?? "").join("") ?? "") + "\n```\n");
      return;
    }
    if (type === "table") {
      node.content?.forEach((row) => {
        const cells = (row.content ?? []).map((cell) => inlineText(cell));
        buffer.push(cells.join(" | "));
        buffer.push("\n");
      });
      return;
    }
    node.content?.forEach((child) => walk(child, opts));
  }

  walk(doc, { headingPath: [] });
  flush();
  if (sections.length === 0) {
    const text = inlineText(doc).trim();
    if (text) sections.push({ headingPath: "", text });
  }
  return sections;
}

function inlineText(node: EditorDocument | undefined): string {
  if (!node) return "";
  if (node.text) return node.text;
  return (node.content ?? []).map(inlineText).join("");
}
