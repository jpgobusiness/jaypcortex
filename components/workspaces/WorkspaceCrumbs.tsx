"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { folderHref, workspaceHref } from "@/lib/workspaces";

type CrumbWorkspace = { id: string; name: string; color?: string };

export default function WorkspaceCrumbs({
  workspace,
  folder,
  folders,
}: {
  workspace?: CrumbWorkspace | null;
  folder?: { id: string; name: string } | null;
  folders?: { id: string; name: string }[];
}) {
  const chain = folders ?? (folder ? [folder] : []);
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
      {workspace && chain.map((item) => (
        <span key={item.id} className="flex min-w-0 items-center gap-1">
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          <Link
            href={folderHref(workspace.id, item.id)}
            className="truncate hover:text-[var(--foreground)]"
          >
            {item.name}
          </Link>
        </span>
      ))}
    </nav>
  );
}
