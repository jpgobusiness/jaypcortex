"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { folderHref, workspaceHref } from "@/lib/workspaces";

type CrumbWorkspace = { id: string; name: string; color?: string };

export default function WorkspaceCrumbs({
  workspace,
  folder,
}: {
  workspace?: CrumbWorkspace | null;
  folder?: { id: string; name: string } | null;
}) {
  return (
    <nav aria-label="Caminho" className="flex min-w-0 items-center gap-1 text-xs text-[var(--muted)]">
      <Link href="/espacos" className="hover:text-[var(--foreground)]">
        Espaços
      </Link>
      {workspace && (
        <>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          <Link
            href={workspaceHref(workspace.id)}
            className="flex min-w-0 items-center gap-1.5 truncate hover:text-[var(--foreground)]"
          >
            {workspace.color && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: workspace.color }}
                aria-hidden
              />
            )}
            <span className="truncate">{workspace.name}</span>
          </Link>
        </>
      )}
      {folder && workspace && (
        <>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          <Link
            href={folderHref(workspace.id, folder.id)}
            className="truncate text-[var(--foreground)] hover:underline"
          >
            {folder.name}
          </Link>
        </>
      )}
    </nav>
  );
}
