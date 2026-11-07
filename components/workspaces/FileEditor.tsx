"use client";

import { memo, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Highlight } from "@tiptap/extension-highlight";
import EditorToolbar from "@/components/workspaces/EditorToolbar";
import { DEFAULT_FILE_TITLE, TITLE_MAX_LENGTH } from "@/lib/workspaces";
import type { EditorDocument } from "@/lib/types";

type Props = {
  initialTitle: string;
  initialContent: EditorDocument | null;
  autoFocusTitle?: boolean;
  onTitleChange: (title: string) => void;
  onContentChange: (doc: JSONContent) => void;
};

/**
 * Título + conteúdo de um arquivo. Fica isolado (memo) para o editor não
 * renderizar de novo quando a página muda o status de salvamento.
 */
function FileEditor({
  initialTitle,
  initialContent,
  autoFocusTitle = false,
  onTitleChange,
  onContentChange,
}: Props) {
  const onContentChangeRef = useRef(onContentChange);
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Placeholder.configure({
        placeholder:
          "Escreva aqui. Atalhos: # título, - lista, 1. lista numerada, [ ] checklist, > citação.",
      }),
    ],
    content: initialContent,
    // Next.js renderiza no servidor; o editor só monta no navegador.
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: "tiptap-content",
        "aria-label": "Conteúdo do arquivo",
      },
    },
    onUpdate: ({ editor: current }) => {
      const doc = current.getJSON();
      // Evita atualizar estado do React no meio de uma transação do editor.
      queueMicrotask(() => onContentChangeRef.current(doc));
    },
  });

  return (
    <div className="flex flex-1 flex-col">
      <EditorToolbar editor={editor} />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-10 sm:px-8 sm:pt-16">
        <TitleField
          initialValue={initialTitle}
          autoFocus={autoFocusTitle}
          onChange={onTitleChange}
          onEnter={() => editor?.commands.focus("start")}
        />
        <EditorContent editor={editor} className="mt-5" />
      </div>
    </div>
  );
}

export default memo(FileEditor);

function TitleField({
  initialValue,
  autoFocus,
  onChange,
  onEnter,
}: {
  initialValue: string;
  autoFocus: boolean;
  onChange: (value: string) => void;
  onEnter: () => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <textarea
      value={value}
      rows={1}
      maxLength={TITLE_MAX_LENGTH}
      placeholder={DEFAULT_FILE_TITLE}
      aria-label="Título do arquivo"
      autoFocus={autoFocus}
      onChange={(event) => {
        // Título é uma linha só: quebras viram espaço (ex.: ao colar).
        const next = event.target.value.replace(/\s*\n+\s*/g, " ");
        setValue(next);
        onChange(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onEnter();
        }
      }}
      className="field-sizing-content w-full resize-none bg-transparent text-3xl font-bold leading-tight text-[var(--foreground)] outline-none placeholder:text-slate-300 sm:text-4xl"
    />
  );
}
