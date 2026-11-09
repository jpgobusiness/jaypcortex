"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { apiGet } from "@/lib/fetcher";
import { formatBRL, opportunityChipLabel } from "@/lib/opportunities/format";
import type { FunnelOpportunityChip } from "@/lib/types";

type Row = FunnelOpportunityChip & {
  folders?: { id: string; name: string }[];
};

export default function ComercialPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Row[]>("/api/opportunities")
      .then(setRows)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Erro"));
  }, []);

  return (
    <div>
      <PageHeader title="Comercial" subtitle="Funil e documentos da oportunidade" />
      <div className="mx-auto w-full max-w-5xl space-y-3 p-4 sm:p-6">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!rows && !error && <p className="text-sm text-[var(--muted)]">Carregando...</p>}
        {rows?.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-[var(--muted)]">
            Nenhuma oportunidade no funil.
          </p>
        )}
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          {rows?.map((row) => (
            <li key={row.id}>
              <Link
                href={`/comercial/${row.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]"
              >
                {row.stage && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.stage.color }}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                    {row.name}
                  </span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {opportunityChipLabel(row)}
                    {row.folders?.length ? ` · ${row.folders.length} pasta(s)` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-[var(--muted)]">
                  {row.value ? formatBRL(row.value) : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
