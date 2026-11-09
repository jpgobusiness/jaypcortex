"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import { apiDelete, apiGet } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/workspaces";
import type { FolderAsset } from "@/lib/types";

type Props = { folderId: string; disabled?: boolean; standalone?: boolean };

export default function FolderDeliveries({ folderId, disabled, standalone }: Props) {
  const [items, setItems] = useState<FolderAsset[]>([]);
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const rows = await apiGet<FolderAsset[]>(
      `/api/workspaces/folders/${folderId}/assets?kind=entrega`
    );
    setItems(rows);
  }, [folderId]);

  useEffect(() => {
    load().catch(() => setItems([]));
  }, [load]);

  async function signed(assetId: string) {
    return apiGet<FolderAsset & { url: string }>(`/api/workspaces/assets/${assetId}`);
  }

  async function open(item: FolderAsset) {
    setBusy(true);
    try {
      const row = await signed(item.id);
      setPreview({ name: item.name, url: row.url });
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Não foi possível abrir a entrega");
    } finally {
      setBusy(false);
    }
  }

  async function download(item: FolderAsset) {
    setBusy(true);
    try {
      const row = await signed(item.id);
      const a = document.createElement("a");
      a.href = row.url;
      a.download = item.name;
      a.rel = "noreferrer";
      a.target = "_blank";
      a.click();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Não foi possível baixar");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: FolderAsset) {
    if (!confirm(`Excluir a entrega "${item.name}"?`)) return;
    await apiDelete(`/api/workspaces/assets/${item.id}`);
    if (preview?.name === item.name) setPreview(null);
    await load();
  }

  return (
    <div className={standalone ? "px-4 py-3" : "border-t border-[var(--border)] px-4 py-3"}>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        Entregas
      </h4>
      {items.length === 0 ? (
        <p className="text-[11px] text-[var(--muted)]">Nenhuma entrega HTML ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">{item.name}</span>
              <span className="shrink-0 text-[10px] text-[var(--muted)]">
                {formatDateTime(item.createdAt)}
              </span>
              <button
                type="button"
                title="Abrir"
                disabled={disabled || busy}
                onClick={() => open(item)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Baixar"
                disabled={disabled || busy}
                onClick={() => download(item)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Excluir entrega"
                disabled={disabled || busy}
                onClick={() => remove(item)}
                className="text-[var(--muted)] hover:text-red-600 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2">
              <h5 className="min-w-0 flex-1 truncate text-sm font-semibold">{preview.name}</h5>
              <a
                href={preview.url}
                download={preview.name}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Baixar
              </a>
              <button type="button" onClick={() => setPreview(null)} title="Fechar">
                <X className="h-4 w-4" />
              </button>
            </header>
            <iframe
              title={preview.name}
              src={preview.url}
              sandbox="allow-scripts"
              className="h-full w-full bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
