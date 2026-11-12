"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/form";
import { IconButton } from "@/components/workspaces/WorkspaceFileList";
import { apiDelete, apiGet, apiPostForm } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/workspaces";
import type { FolderAsset } from "@/lib/types";

const MAX_BYTES = 10 * 1024 * 1024;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WorkspaceAttachments({
  workspaceId,
  folderId,
  compact,
  disabled,
}: {
  workspaceId: string;
  folderId?: string | null;
  compact?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<FolderAsset[]>([]);
  const [busy, setBusy] = useState(false);

  const listUrl = folderId
    ? `/api/workspaces/folders/${folderId}/assets?kind=anexo`
    : `/api/workspaces/${workspaceId}/assets`;
  const uploadUrl = folderId
    ? `/api/workspaces/folders/${folderId}/assets`
    : `/api/workspaces/${workspaceId}/assets`;

  const load = useCallback(async () => {
    const rows = await apiGet<FolderAsset[]>(listUrl);
    setItems(rows);
  }, [listUrl]);

  useEffect(() => {
    load().catch(() => setItems([]));
  }, [load]);

  async function signed(assetId: string) {
    return apiGet<FolderAsset & { url: string }>(`/api/workspaces/assets/${assetId}`);
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
    if (!confirm(`Excluir o arquivo "${item.name}"?`)) return;
    setBusy(true);
    try {
      await apiDelete(`/api/workspaces/assets/${item.id}`);
      await load();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao excluir o arquivo");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    const tooBig = list.find((file) => file.size > MAX_BYTES);
    if (tooBig) {
      alert(`"${tooBig.name}" passa de 10 MB. Escolha um arquivo menor.`);
      return;
    }
    setBusy(true);
    try {
      for (const file of list) {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", "anexo");
        await apiPostForm(uploadUrl, form);
      }
      await load();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao enviar o arquivo");
    } finally {
      setBusy(false);
    }
  }

  const heading = compact ? (
    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
      Anexos
    </h4>
  ) : (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">Anexos</h2>
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
      >
        <Upload className="h-4 w-4" /> Enviar arquivo
      </Button>
    </div>
  );

  const body = (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = event.target.files;
          event.target.value = "";
          if (files?.length) void uploadFiles(files);
        }}
      />
      {heading}
      {compact && (
        <div className="mb-2">
          <Button
            variant="outline"
            className="h-8 min-h-0 px-2 py-1 text-xs"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
          >
            <Upload className="h-3.5 w-3.5" /> Enviar arquivo
          </Button>
        </div>
      )}
      {items.length === 0 ? (
        <p className={compact ? "text-[11px] text-[var(--muted)]" : "text-sm text-[var(--muted)]"}>
          Nenhum anexo ainda. Envie PDF, imagem ou qualquer arquivo (até 10 MB).
        </p>
      ) : (
        <ul className={compact ? "space-y-1.5" : "divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"}>
          {items.map((item) =>
            compact ? (
              <li key={item.id} className="flex items-center gap-2 text-xs">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">{item.name}</span>
                <span className="shrink-0 text-[10px] text-[var(--muted)]">
                  {formatBytes(item.size)}
                </span>
                <button
                  type="button"
                  title="Baixar"
                  disabled={disabled || busy}
                  onClick={() => void download(item)}
                  className="text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Excluir arquivo"
                  disabled={disabled || busy}
                  onClick={() => void remove(item)}
                  className="text-[var(--muted)] hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ) : (
              <li key={item.id} className="flex items-center gap-3 py-2 pl-4 pr-2">
                <Paperclip className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatBytes(item.size)} · {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <IconButton
                  title="Baixar"
                  disabled={disabled || busy}
                  onClick={() => void download(item)}
                >
                  <Download className="h-4 w-4" />
                </IconButton>
                <IconButton
                  title="Excluir arquivo"
                  danger
                  disabled={disabled || busy}
                  onClick={() => void remove(item)}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </li>
            )
          )}
        </ul>
      )}
    </>
  );

  if (compact) {
    return <div className="border-t border-[var(--border)] px-4 py-3">{body}</div>;
  }

  return <section>{body}</section>;
}
