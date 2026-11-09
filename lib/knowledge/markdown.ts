import { generateJSON } from "@tiptap/html/server";
import { marked } from "marked";
import type { EditorDocument } from "@/lib/types";
import { documentExtensions } from "@/lib/tiptap/schema-extensions";
import { isEditorDocument } from "@/lib/workspaces";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function markdownToTiptap(markdown: string): EditorDocument {
  const html = marked.parse(markdown || "", { async: false, gfm: true }) as string;
  const safe = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  const json = generateJSON(safe || "<p></p>", documentExtensions);
  if (isEditorDocument(json)) return json;
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function tiptapToMarkdown(doc: EditorDocument | null | undefined): string {
  if (!doc) return "";
  const lines: string[] = [];

  function marks(text: string, node: EditorDocument): string {
    let out = text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") out = `**${out}**`;
      if (mark.type === "italic") out = `_${out}_`;
      if (mark.type === "code") out = `\`${out}\``;
      if (mark.type === "highlight") out = `==${out}==`;
      if (mark.type === "link" && typeof mark.attrs?.href === "string") {
        out = `[${out}](${mark.attrs.href})`;
      }
    }
    return out;
  }

  function walk(node: EditorDocument, listPrefix = ""): void {
    const type = node.type ?? "";
    if (type === "text") {
      lines.push(marks(node.text ?? "", node));
      return;
    }
    if (type === "hardBreak") {
      lines.push("\n");
      return;
    }
    if (type === "heading") {
      const level = Number(node.attrs?.level ?? 1);
      lines.push("\n" + "#".repeat(Math.min(level, 3)) + " ");
      node.content?.forEach((c) => walk(c));
      lines.push("\n\n");
      return;
    }
    if (type === "paragraph") {
      node.content?.forEach((c) => walk(c));
      lines.push("\n\n");
      return;
    }
    if (type === "bulletList") {
      node.content?.forEach((item) => walk(item, "- "));
      return;
    }
    if (type === "orderedList") {
      (node.content ?? []).forEach((item, i) => walk(item, `${i + 1}. `));
      return;
    }
    if (type === "listItem" || type === "taskItem") {
      const checked = node.attrs?.checked ? "[x] " : type === "taskItem" ? "[ ] " : "";
      lines.push(listPrefix + checked);
      node.content?.forEach((c) => walk(c));
      if (!lines.at(-1)?.endsWith("\n")) lines.push("\n");
      return;
    }
    if (type === "blockquote") {
      const inner = (node.content ?? []).map((c) => inline(c)).join("\n");
      lines.push(inner.split("\n").map((l) => `> ${l}`).join("\n") + "\n\n");
      return;
    }
    if (type === "codeBlock") {
      const code = (node.content ?? []).map((c) => c.text ?? "").join("");
      lines.push("\n```\n" + code + "\n```\n\n");
      return;
    }
    if (type === "table") {
      lines.push(tableToMarkdown(node));
      return;
    }
    node.content?.forEach((c) => walk(c, listPrefix));
  }

  function inline(node: EditorDocument): string {
    if (node.text) return marks(node.text, node);
    return (node.content ?? []).map(inline).join("");
  }

  function tableToMarkdown(node: EditorDocument): string {
    const rows = (node.content ?? [])
      .filter((row) => row.type === "tableRow")
      .map((row) =>
        (row.content ?? []).map((cell) =>
          inline(cell).replaceAll("|", "\\|").replace(/\s*\n+\s*/g, " ").trim()
        )
      );
    if (!rows.length) return "";
    const width = Math.max(...rows.map((row) => row.length), 1);
    const padded = rows.map((row) => Array.from({ length: width }, (_, i) => row[i] ?? ""));
    const header = padded[0];
    const sep = header.map(() => "---");
    const body = padded.slice(1).map((row) => `| ${row.join(" | ")} |`);
    return `\n| ${header.join(" | ")} |\n| ${sep.join(" | ")} |\n${body.length ? body.join("\n") + "\n" : ""}\n`;
  }

  walk(doc);
  return lines.join("").replace(/\n{3,}/g, "\n\n").trim();
}

export function emptyDoc(): EditorDocument {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function sanitizeTiptap(value: unknown): EditorDocument {
  if (isEditorDocument(value)) return value;
  if (typeof value === "string") return markdownToTiptap(escapeHtml(value) === value ? value : "");
  return emptyDoc();
}
