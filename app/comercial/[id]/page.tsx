"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import KindBadge from "@/components/workspaces/KindBadge";
import { apiGet } from "@/lib/fetcher";
import { formatBRL } from "@/lib/opportunities/format";
import { fileHref, formatDateTime } from "@/lib/workspaces";

type FileRow = {
  id: string;
  title: string;
  kind: string;
  updatedAt: string;
  workspaceId: string;
  url: string;
};

type FolderRow = {
  id: string;
  name: string;
  workspaceId: string;
  files: FileRow[];
};

type Detail = {
  id: string;
  name: string;
  client: string | null;
  value: number;
  description: string | null;
  stage: { id: string; name: string; color: string } | null;
  folders: FolderRow[];
};

export default function ComercialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Detail>(`/api/opportunities/${id}`)
      .then(setRow)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Erro"));
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-base font-semibold">Não foi possível abrir</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{error}</p>
        <Link href="/comercial" className="mt-4 inline-flex text-sm text-[var(--brand-600)] hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  if (!row) return <p className="py-10 text-center text-[var(--muted)]">Carregando...</p>;

  const files = row.folders.flatMap((folder) => folder.files);

  return (
    <div>
      <PageHeader
        title={row.name}
        subtitle={[row.client, row.stage?.name, row.value ? formatBRL(row.value) : null]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
        {row.description && (
          <p className="text-sm text-[var(--muted)]">{row.description}</p>
        )}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Documentos</h2>
          {files.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--border)] py-8 text-center text-sm text-[var(--muted)]">
              Nenhuma pasta vinculada. Crie a oportunidade em Espaços e ligue ao funil.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              {row.folders.map((folder) =>
                folder.files.map((file) => (
                  <li key={file.id}>
                    <Link
                      href={fileHref(file.workspaceId, file.id)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]"
                    >
                      <KindBadge kind={file.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{file.title}</span>
                        <span className="block truncate text-xs text-[var(--muted)]">{folder.name}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--muted)]">
                        {formatDateTime(file.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
