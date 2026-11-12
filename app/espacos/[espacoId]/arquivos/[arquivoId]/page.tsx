"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import FileEditor from "@/components/workspaces/FileEditor";
import { Button } from "@/components/ui/form";
import { useWorkspaces } from "@/components/workspaces/WorkspacesProvider";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/fetcher";
import {
  DEFAULT_FILE_TITLE,
  fileHref,
  folderHref,
  formatDateTime,
  workspaceHref,
} from "@/lib/workspaces";
import type { WorkspaceFileDetail, WorkspaceFileSummary } from "@/lib/types";
import { DOCUMENT_KINDS, KIND_LABELS, type DocumentKind } from "@/lib/knowledge/kinds";

type SaveStatus = "saved" | "saving" | "error";

export default function ArquivoPage() {
  const { espacoId, arquivoId } = useParams<{
    espacoId: string;
    arquivoId: string;
  }>();
  // A key garante estado novo ao trocar de arquivo.
  return <FilePage key={arquivoId} workspaceId={espacoId} fileId={arquivoId} />;
}

function FilePage({ workspaceId, fileId }: { workspaceId: string; fileId: string }) {
  const router = useRouter();
  const { workspaces, reload } = useWorkspaces();
  const [file, setFile] = useState<WorkspaceFileDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [editorNonce, setEditorNonce] = useState(0);
  const draftContent = useRef<JSONContent | null>(null);
  const savedAtRef = useRef<string | null>(null);
  const editing = mode === "edit";

  useEffect(() => {
    savedAtRef.current = savedAt;
  }, [savedAt]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("editar") !== "1") return;
    setMode("edit");
    router.replace(fileHref(workspaceId, fileId), { scroll: false });
  }, [fileId, workspaceId, router]);

  useEffect(() => {
    let cancelled = false;
    apiGet<WorkspaceFileDetail>(`/api/workspaces/files/${fileId}`).then(
      (data) => {
        if (cancelled) return;
        if (data.workspaceId !== workspaceId) {
          router.replace(fileHref(data.workspaceId, data.id));
          return;
        }
        setFile(data);
        setTitle(data.title === DEFAULT_FILE_TITLE ? "" : data.title);
        setFolderId(data.folderId);
        setSavedAt(data.updatedAt);
        draftContent.current = data.content;
      },
      (cause: unknown) => {
        if (cancelled) return;
        setLoadError(
          cause instanceof Error ? cause.message : "Erro ao abrir o arquivo"
        );
      }
    );
    return () => {
      cancelled = true;
    };
  }, [fileId, workspaceId, router]);

  // Na visualização, puxa o que o MCP gravou sem precisar recarregar a página.
  useEffect(() => {
    if (mode !== "view") return;
    const tick = window.setInterval(() => {
      void apiGet<WorkspaceFileDetail>(`/api/workspaces/files/${fileId}`).then((data) => {
        if (data.updatedAt === savedAtRef.current) return;
        setFile(data);
        setTitle(data.title === DEFAULT_FILE_TITLE ? "" : data.title);
        setFolderId(data.folderId);
        setSavedAt(data.updatedAt);
        draftContent.current = data.content;
        setEditorNonce((n) => n + 1);
        void reload();
      });
    }, 6000);
    return () => window.clearInterval(tick);
  }, [mode, fileId, reload]);

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    setDirty(true);
  }, []);
  const handleContentChange = useCallback((doc: JSONContent) => {
    draftContent.current = doc;
    setDirty(true);
  }, []);

  const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
  const folder = workspace?.folders.find((item) => item.id === folderId) ?? null;

  function startEdit() {
    setMode("edit");
    setDirty(false);
    setStatus("saved");
  }

  function cancelEdit() {
    if (dirty && !confirm("Descartar as alterações não salvas?")) return;
    if (!file) return;
    setTitle(file.title === DEFAULT_FILE_TITLE ? "" : file.title);
    draftContent.current = file.content;
    setDirty(false);
    setStatus("saved");
    setMode("view");
    setEditorNonce((n) => n + 1);
  }

  async function save() {
    setStatus("saving");
    try {
      const saved = await apiPatch<WorkspaceFileSummary>(`/api/workspaces/files/${fileId}`, {
        title,
        content: draftContent.current ?? file?.content,
      });
      setFile((current) =>
        current
          ? {
              ...current,
              ...saved,
              content: (draftContent.current ?? current.content) as WorkspaceFileDetail["content"],
            }
          : current
      );
      setSavedAt(saved.updatedAt);
      setDirty(false);
      setStatus("saved");
      setMode("view");
      setEditorNonce((n) => n + 1);
      await reload();
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (mode === "edit" && dirty && status !== "saving") void save();
      }
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [mode, dirty, status, title, file, fileId, reload]);

  async function moveTo(nextFolderId: string | null) {
    setMoving(true);
    try {
      const saved = await apiPatch<WorkspaceFileSummary>(
        `/api/workspaces/files/${fileId}`,
        { folderId: nextFolderId }
      );
      setFolderId(saved.folderId);
      setSavedAt(saved.updatedAt);
      await reload();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao mover o arquivo");
    } finally {
      setMoving(false);
    }
  }

  async function remove() {
    const name = title.trim() || DEFAULT_FILE_TITLE;
    if (!confirm(`Excluir o arquivo "${name}"?`)) return;
    try {
      await apiDelete(`/api/workspaces/files/${fileId}`);
      router.push(workspaceHref(workspaceId));
      await reload();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Erro ao excluir o arquivo");
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-base font-semibold text-[var(--foreground)]">
          Não foi possível abrir o arquivo
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{loadError}</p>
        <Link
          href={workspaceHref(workspaceId)}
          className="mt-4 inline-flex text-sm font-medium text-[var(--brand-600)] hover:underline"
        >
          Voltar para o espaço
        </Link>
      </div>
    );
  }

  if (!file) {
    return <p className="py-10 text-center text-[var(--muted)]">Carregando...</p>;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--surface)]">
      <div className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <nav
          aria-label="Caminho do arquivo"
          className="flex min-w-0 items-center gap-1 text-xs text-[var(--muted)]"
        >
          <Link
            href={workspaceHref(workspaceId)}
            className="flex min-w-0 shrink items-center gap-1.5 truncate hover:text-[var(--foreground)]"
          >
            {workspace && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: workspace.color }}
                aria-hidden
              />
            )}
            <span className="truncate">{workspace?.name ?? "Espaço"}</span>
          </Link>
          {folder && (
            <>
              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
              <Link
                href={folderHref(workspaceId, folder.id)}
                className="truncate hover:text-[var(--foreground)]"
              >
                {folder.name}
              </Link>
            </>
          )}
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate text-[var(--foreground)]">
            {title.trim() || DEFAULT_FILE_TITLE}
          </span>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <SaveIndicator
            status={status}
            savedAt={savedAt}
            dirty={dirty}
            editing={editing}
            onRetry={() => void save()}
          />
          {editing ? (
            <>
              <Button type="button" variant="ghost" onClick={cancelEdit} className="h-9 px-3 md:h-8">
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void save()}
                disabled={status === "saving" || !dirty}
                className="h-9 px-3 md:h-8"
              >
                {status === "saving" ? "Salvando..." : "Salvar"}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={startEdit} className="h-9 px-3 md:h-8">
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          )}
          {workspace && (
            <select
              value={folderId ?? ""}
              onChange={(event) => moveTo(event.target.value || null)}
              disabled={moving || editing}
              aria-label="Pasta do arquivo"
              title="Mover para outra pasta"
              className="h-9 max-w-44 rounded-lg border border-[var(--border)] bg-white px-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--brand)] md:h-8"
            >
              <option value="">Sem pasta</option>
              {workspace.folders.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={remove}
            title="Excluir arquivo"
            aria-label="Excluir arquivo"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-600 md:h-8 md:w-8"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <FileMetaBar
        fileId={fileId}
        file={file}
        locked={!editing}
        onPatched={(saved) => setSavedAt(saved.updatedAt)}
      />

      <FileEditor
        key={`${fileId}-${mode}-${editorNonce}`}
        initialTitle={title}
        initialContent={(draftContent.current ?? file.content) as WorkspaceFileDetail["content"]}
        editable={editing}
        autoFocusTitle={editing && !title}
        onTitleChange={handleTitleChange}
        onContentChange={handleContentChange}
      />
    </div>
  );
}

function FileMetaBar({
  fileId,
  file,
  locked,
  onPatched,
}: {
  fileId: string;
  file: WorkspaceFileDetail & { kind?: string; tags?: string[]; indexStatus?: string; source?: string };
  locked: boolean;
  onPatched: (saved: WorkspaceFileSummary) => void;
}) {
  const [kind, setKind] = useState(file.kind ?? "contexto");
  const [tags, setTags] = useState((file.tags ?? []).join(", "));
  const [revisions, setRevisions] = useState<{ id: string; createdAt: string; source: string; note?: string | null }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const editedByQuick = file.source === "mcp";

  useEffect(() => {
    setKind(file.kind ?? "contexto");
    setTags((file.tags ?? []).join(", "));
  }, [file.kind, file.tags, file.updatedAt]);

  async function saveMeta() {
    if (locked) return;
    const saved = await apiPatch<WorkspaceFileSummary>(`/api/workspaces/files/${fileId}`, {
      kind,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    onPatched(saved);
  }

  async function loadHistory() {
    setShowHistory((v) => !v);
    if (!showHistory) {
      setRevisions(await apiGet(`/api/workspaces/files/${fileId}/revisions`));
    }
  }

  async function restore(revisionId: string) {
    const saved = await apiPost<WorkspaceFileSummary>(`/api/workspaces/files/${fileId}/revisions`, { revisionId });
    onPatched(saved);
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-2 border-b border-[var(--border)] bg-[#fafafa] px-4 py-2 text-xs sm:flex-row sm:items-center sm:px-6">
      <select
        value={kind}
        disabled={locked}
        onChange={(e) => setKind(e.target.value)}
        onBlur={() => void saveMeta()}
        className="h-8 rounded-md border border-[var(--border)] bg-white px-2 disabled:cursor-default disabled:bg-[#fafafa]"
      >
        {DOCUMENT_KINDS.map((k) => (
          <option key={k} value={k}>{KIND_LABELS[k as DocumentKind]}</option>
        ))}
      </select>
      <input
        value={tags}
        readOnly={locked}
        onChange={(e) => setTags(e.target.value)}
        onBlur={() => void saveMeta()}
        placeholder="tags, separadas por vírgula"
        className="h-8 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-white px-2 read-only:cursor-default read-only:bg-[#fafafa]"
      />
      <span className="text-[var(--muted)]">
        {file.indexStatus ?? "pending"} · {file.source ?? "ui"}
      </span>
      {editedByQuick && (
        <span
          className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-700"
          title={`Editado ${new Date(file.updatedAt).toLocaleString("pt-BR")}`}
        >
          editado pelo Quick
        </span>
      )}
      <button type="button" onClick={() => void loadHistory()} className="font-medium text-[var(--brand-600)]">
        Histórico
      </button>
      {showHistory && (
        <ul className="w-full sm:w-auto">
          {revisions.map((rev) => (
            <li
              key={rev.id}
              className={`flex items-center gap-2 py-0.5 ${rev.note ? "font-medium text-[var(--foreground)]" : ""}`}
            >
              <span>
                {new Date(rev.createdAt).toLocaleString("pt-BR")} · {rev.source}
                {rev.note ? ` · ${rev.note}` : ""}
              </span>
              <button type="button" className="text-[var(--brand-600)]" onClick={() => void restore(rev.id)}>restaurar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SaveIndicator({
  status,
  savedAt,
  dirty,
  editing,
  onRetry,
}: {
  status: SaveStatus;
  savedAt: string | null;
  dirty: boolean;
  editing: boolean;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline"
      >
        <CircleAlert className="h-3.5 w-3.5" /> Erro ao salvar. Tentar de novo
      </button>
    );
  }
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Salvando...
      </span>
    );
  }
  if (editing && dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        Não salvo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
      <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />
      {savedAt ? `Salvo ${formatDateTime(savedAt)}` : "Salvo na base"}
    </span>
  );
}
