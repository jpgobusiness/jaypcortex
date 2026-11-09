"use client";

import Link from "next/link";
import { FileText, Trash2 } from "lucide-react";
import KindBadge from "@/components/workspaces/KindBadge";
import { fileHref, formatDateTime } from "@/lib/workspaces";
import type { WorkspaceFileSummary } from "@/lib/types";

export default function WorkspaceFileList({
  files,
  folderNames,
  onDelete,
}: {
  files: WorkspaceFileSummary[];
  folderNames?: Map<string, string>;
  onDelete: (file: WorkspaceFileSummary) => void;
}) {
  return (
    <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      {files.map((file) => (
        <li key={file.id} className="flex items-center gap-3 py-2 pl-4 pr-2 hover:bg-black/[0.02]">
          <FileText className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <Link href={fileHref(file.workspaceId, file.id)} className="min-w-0 flex-1 py-1">
            <span className="flex items-center gap-1.5">
              <KindBadge kind={file.kind} />
              <span className="truncate text-sm font-medium text-[var(--foreground)]">
                {file.title}
              </span>
            </span>
            <span className="block truncate text-xs text-[var(--muted)]">
              {folderNames
                ? `${file.folderId ? folderNames.get(file.folderId) : "Sem pasta"}${
                    file.excerpt ? ` · ${file.excerpt}` : ""
                  }`
                : file.excerpt || "Sem conteúdo ainda"}
            </span>
          </Link>
          <span className="hidden shrink-0 text-[11px] text-[var(--muted)] sm:block">
            {formatDateTime(file.updatedAt)}
          </span>
          <IconButton title="Excluir arquivo" danger onClick={() => onDelete(file)}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}

export function IconButton({
  title,
  danger = false,
  disabled = false,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors disabled:opacity-50 ${
        danger
          ? "hover:bg-red-50 hover:text-red-600"
          : "hover:bg-black/[0.05] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}
