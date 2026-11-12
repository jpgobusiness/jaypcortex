"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { IconButton } from "@/components/workspaces/WorkspaceFileList";
import { useWorkspaces } from "@/components/workspaces/WorkspacesProvider";
import { apiDelete, apiGet, apiPatch, apiPostForm } from "@/lib/fetcher";
import type { FolderAsset, WorkspaceFolder, WorkspaceTree } from "@/lib/types";

const MAX_BYTES = 10 * 1024 * 1024;

function clientNameOf(
  workspaces: WorkspaceTree[],
  workspaceId: string,
  folderId?: string | null
) {
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const folder: WorkspaceFolder | undefined = folderId
    ? workspace?.folders.find((item) => item.id === folderId)
    : undefined;
  const client = folder?.opportunity?.client?.trim();
  if (client) return client;
  const opportunity = folder?.opportunity?.name?.trim();
  if (opportunity) return opportunity;
  if (folder?.name?.trim()) return folder.name;
  return workspace?.name?.trim() || "—";
}

function AssetNameField({
  name,
  compact,
  disabled,
  onSave,
}: {
  name: string;
  compact?: boolean;
  disabled?: boolean;
  onSave: (name: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  async function commit() {
    const next = draft.trim();
    if (!next) {
      setDraft(name);
      return;
    }
    if (next === name) return;
    try {
      await onSave(next);
    } catch (cause) {
      setDraft(name);
      alert(cause instanceof Error ? cause.message : "Erro ao salvar o nome");
    }
  }

  return (
    <textarea
      value={draft}
      disabled={disabled}
      rows={1}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit()}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setDraft(name);
          event.currentTarget.blur();
        }
      }}
      maxLength={200}
      aria-label="Nome do arquivo"
      title="Clique para editar o nome"
      className={`w-full resize-none break-all rounded-md bg-transparent outline-none [field-sizing:content] placeholder:text-[var(--muted)] hover:bg-black/[0.03] focus:bg-black/[0.03] focus:ring-2 focus:ring-[var(--brand)]/20 disabled:opacity-50 ${
        compact
          ? "min-h-7 px-1 py-0.5 text-xs leading-5 text-[var(--foreground)]"
          : "min-h-8 px-1 py-1 text-sm font-medium leading-5 text-[var(--foreground)]"
      }`}
    />
  );
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
  const inputId = useId();
  const { reload, workspaces } = useWorkspaces();
  const [items, setItems] = useState<FolderAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

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

  async function rename(item: FolderAsset, name: string) {
    const saved = await apiPatch<FolderAsset>(`/api/workspaces/assets/${item.id}`, { name });
    setItems((current) => current.map((row) => (row.id === saved.id ? { ...row, name: saved.name } : row)));
    void reload();
  }

  async function remove(item: FolderAsset) {
    if (!confirm(`Excluir o arquivo "${item.name}"?`)) return;
    setBusy(true);
    try {
      await apiDelete(`/api/workspaces/assets/${item.id}`);
      await load();
      await reload();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao excluir o arquivo");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: File[]) {
    const list = files.filter((file) => file.size >= 0 && file.name);
    if (list.length === 0) return;
    const tooBig = list.find((file) => file.size > MAX_BYTES);
    if (tooBig) {
      alert(`"${tooBig.name}" passa de 10 MB. Escolha um arquivo menor.`);
      return;
    }
    setBusy(true);
    try {
      for (let i = 0; i < list.length; i += 1) {
        const file = list[i];
        setProgress(`Enviando ${i + 1}/${list.length}: ${file.name}`);
        const form = new FormData();
        form.append("file", file);
        form.append("kind", "anexo");
        await apiPostForm(uploadUrl, form);
      }
      await load();
      await reload();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao enviar o arquivo");
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  const blocked = disabled || busy;
  const pickLabel = compact ? (
    <label
      htmlFor={inputId}
      className={`inline-flex h-8 min-h-0 cursor-pointer items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-black/[0.03] ${
        blocked ? "pointer-events-none cursor-not-allowed opacity-50" : ""
      }`}
    >
      <Upload className="h-3.5 w-3.5" /> Enviar arquivo
    </label>
  ) : (
    <label
      htmlFor={inputId}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-black/[0.03] md:min-h-0 md:py-2 ${
        blocked ? "pointer-events-none cursor-not-allowed opacity-50" : ""
      }`}
    >
      <Upload className="h-4 w-4" /> Enviar arquivo
    </label>
  );

  const heading = compact ? (
    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
      Anexos
    </h4>
  ) : (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">Anexos</h2>
      {pickLabel}
    </div>
  );

  const body = (
    <>
      <input
        id={inputId}
        type="file"
        multiple
        disabled={blocked}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) void uploadFiles(files);
        }}
      />
      {heading}
      {compact && <div className="mb-2">{pickLabel}</div>}
      {progress && (
        <p className={compact ? "mb-2 text-[11px] text-[var(--muted)]" : "mb-2 text-sm text-[var(--muted)]"}>
          {progress}
        </p>
      )}
      {items.length === 0 ? (
        <p className={compact ? "text-[11px] text-[var(--muted)]" : "text-sm text-[var(--muted)]"}>
          Nenhum anexo ainda. Envie PDF, imagem ou qualquer arquivo (até 10 MB).
        </p>
      ) : (
        <div className={compact ? "overflow-x-auto" : "overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className={compact ? "px-1 py-1.5 font-medium" : "px-4 py-3 font-medium"}>Arquivo</th>
                <th className={compact ? "px-1 py-1.5 font-medium" : "px-4 py-3 font-medium"}>Cliente</th>
                <th className={compact ? "w-14 px-1 py-1.5 font-medium" : "w-24 px-3 py-3 font-medium"}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--border)] last:border-0 align-top">
                  <td className={compact ? "px-1 py-1.5" : "px-4 py-3"}>
                    <AssetNameField
                      name={item.name}
                      compact={compact}
                      disabled={blocked}
                      onSave={(name) => rename(item, name)}
                    />
                  </td>
                  <td
                    className={
                      compact
                        ? "px-1 py-1.5 text-xs text-[var(--foreground)]"
                        : "px-4 py-3 text-sm text-[var(--foreground)]"
                    }
                  >
                    {clientNameOf(workspaces, item.workspaceId || workspaceId, item.folderId ?? folderId)}
                  </td>
                  <td className={compact ? "px-1 py-1.5" : "px-2 py-2"}>
                    <div className="flex items-center justify-end gap-1">
                      {compact ? (
                        <>
                          <button
                            type="button"
                            title="Baixar"
                            disabled={blocked}
                            onClick={() => void download(item)}
                            className="text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Excluir arquivo"
                            disabled={blocked}
                            onClick={() => void remove(item)}
                            className="text-[var(--muted)] hover:text-red-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <IconButton
                            title="Baixar"
                            disabled={blocked}
                            onClick={() => void download(item)}
                          >
                            <Download className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            title="Excluir arquivo"
                            danger
                            disabled={blocked}
                            onClick={() => void remove(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const shellClass = compact
    ? `border-t border-[var(--border)] px-4 py-3 ${dragging ? "bg-[var(--brand)]/5" : ""}`
    : dragging
      ? "rounded-2xl ring-2 ring-[var(--brand)]/40"
      : "";

  return (
    <section
      className={shellClass}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!blocked) setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!blocked) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (blocked) return;
        const files = Array.from(event.dataTransfer.files ?? []);
        if (files.length) void uploadFiles(files);
      }}
    >
      {body}
    </section>
  );
}
