"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";

type IconType = React.ComponentType<{ className?: string }>;

/** Aceita http(s) e e-mail. Sem protocolo, assume https. */
function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^mailto:/i.test(value)) return value;
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Barra de formatação do editor de arquivos. */
export default function EditorToolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            underline: current.isActive("underline"),
            strike: current.isActive("strike"),
            code: current.isActive("code"),
            highlight: current.isActive("highlight"),
            link: current.isActive("link"),
            h1: current.isActive("heading", { level: 1 }),
            h2: current.isActive("heading", { level: 2 }),
            h3: current.isActive("heading", { level: 3 }),
            bulletList: current.isActive("bulletList"),
            orderedList: current.isActive("orderedList"),
            taskList: current.isActive("taskList"),
            blockquote: current.isActive("blockquote"),
            codeBlock: current.isActive("codeBlock"),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
          }
        : null,
  });

  function run(command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) {
    if (!editor) return;
    command(editor.chain().focus()).run();
  }

  function toggleLink() {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const typed = window.prompt("Endereço do link (ex.: https://site.com)");
    if (typed === null) return;
    const href = normalizeUrl(typed);
    if (!href) {
      window.alert("Link inválido. Use um endereço http(s) ou mailto.");
      return;
    }
    if (editor.state.selection.empty) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
  }

  const groups: { label: string; icon: IconType; active?: boolean; disabled?: boolean; onClick: () => void }[][] = [
    [
      { label: "Desfazer", icon: Undo2, disabled: !state?.canUndo, onClick: () => run((c) => c.undo()) },
      { label: "Refazer", icon: Redo2, disabled: !state?.canRedo, onClick: () => run((c) => c.redo()) },
    ],
    [
      { label: "Título 1", icon: Heading1, active: state?.h1, onClick: () => run((c) => c.toggleHeading({ level: 1 })) },
      { label: "Título 2", icon: Heading2, active: state?.h2, onClick: () => run((c) => c.toggleHeading({ level: 2 })) },
      { label: "Título 3", icon: Heading3, active: state?.h3, onClick: () => run((c) => c.toggleHeading({ level: 3 })) },
    ],
    [
      { label: "Negrito", icon: Bold, active: state?.bold, onClick: () => run((c) => c.toggleBold()) },
      { label: "Itálico", icon: Italic, active: state?.italic, onClick: () => run((c) => c.toggleItalic()) },
      { label: "Sublinhado", icon: Underline, active: state?.underline, onClick: () => run((c) => c.toggleUnderline()) },
      { label: "Riscado", icon: Strikethrough, active: state?.strike, onClick: () => run((c) => c.toggleStrike()) },
      { label: "Marca-texto", icon: Highlighter, active: state?.highlight, onClick: () => run((c) => c.toggleHighlight()) },
      { label: "Código", icon: Code, active: state?.code, onClick: () => run((c) => c.toggleCode()) },
      {
        label: state?.link ? "Remover link" : "Link",
        icon: state?.link ? Unlink : Link,
        active: state?.link,
        onClick: toggleLink,
      },
    ],
    [
      { label: "Lista", icon: List, active: state?.bulletList, onClick: () => run((c) => c.toggleBulletList()) },
      { label: "Lista numerada", icon: ListOrdered, active: state?.orderedList, onClick: () => run((c) => c.toggleOrderedList()) },
      { label: "Checklist", icon: ListChecks, active: state?.taskList, onClick: () => run((c) => c.toggleTaskList()) },
    ],
    [
      { label: "Citação", icon: Quote, active: state?.blockquote, onClick: () => run((c) => c.toggleBlockquote()) },
      { label: "Bloco de código", icon: SquareCode, active: state?.codeBlock, onClick: () => run((c) => c.toggleCodeBlock()) },
      { label: "Divisor", icon: Minus, onClick: () => run((c) => c.setHorizontalRule()) },
    ],
  ];

  return (
    <div
      role="toolbar"
      aria-label="Formatação"
      className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur"
    >
      <div className="scroll-x-fade mx-auto flex max-w-3xl items-center gap-1 px-3 py-1.5 sm:px-6">
        {groups.map((group, index) => (
          <div key={index} className="flex shrink-0 items-center gap-0.5">
            {index > 0 && <span className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden />}
            {group.map(({ label, icon: Icon, active, disabled, onClick }) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={active ?? undefined}
                disabled={!editor || disabled}
                // Mantém a seleção do texto ao clicar no botão.
                onMouseDown={(event) => event.preventDefault()}
                onClick={onClick}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8 ${
                  active
                    ? "bg-[var(--brand)]/12 text-[var(--brand-600)]"
                    : "text-[var(--muted)] hover:bg-black/[0.05] hover:text-[var(--foreground)]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
