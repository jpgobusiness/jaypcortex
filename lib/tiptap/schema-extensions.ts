import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Highlight } from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";

/**
 * Schema do documento: o mesmo no conversor Markdown → TipTap e no editor.
 * Sem Table, o HTML `<table>` do marked vira parágrafo corrido.
 */
export const documentExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight,
  TableKit.configure({
    table: { resizable: false, renderWrapper: true },
  }),
];
