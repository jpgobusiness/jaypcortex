import { generateJSON } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Highlight } from "@tiptap/extension-highlight";
import { marked } from "marked";
import type { EditorDocument } from "@/lib/types";
import { isEditorDocument } from "@/lib/workspaces";

const EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight,
];

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
  const json = generateJSON(safe || "<p></p>", EXTENSIONS);
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
    node.content?.forEach((c) => walk(c, listPrefix));
  }

  function inline(node: EditorDocument): string {
    if (node.text) return marks(node.text, node);
    return (node.content ?? []).map(inline).join("");
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
