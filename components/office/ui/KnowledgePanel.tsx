"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, ExternalLink, FilePlus, Link2, Search, X } from "lucide-react";
import Drawer from "@/components/office/ui/Drawer";
import { useWorkspaces } from "@/components/workspaces/WorkspacesProvider";
import { apiDelete, apiGet, apiPost } from "@/lib/fetcher";
import { fileHref, formatDateTime, TITLE_MAX_LENGTH } from "@/lib/workspaces";
import { firstName } from "@/lib/agents";
import type { Agent, AgentKnowledgeItem } from "@/lib/types";

type Doc = {
  id: string;
  title: string;
  excerpt: string;
  workspaceId: string;
  workspaceName: string;
  folderName: string | null;
  updatedAt: string;
};

const PICKER_LIMIT = 60;

/** Documentos que o agente usa como referência, anexados de qualquer espaço. */
export default function KnowledgePanel({
  agent,
  onClose,
  onChanged,
  embedded = false,
}: {
  agent: Agent;
  onClose: () => void;
  onChanged: () => void;
  embedded?: boolean;
}) {
  const router = useRouter();
  const { workspaces, reload: reloadWorkspaces } = useWorkspaces();
  const [items, setItems] = useState<AgentKnowledgeItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const name = firstName(agent.name);

  useEffect(() => {
    let cancelled = false;
    apiGet<AgentKnowledgeItem[]>(`/api/agents/${agent.id}/knowledge`).then(
      (data) => {
        if (!cancelled) setItems(data);
      },
      (cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Erro ao carregar a base");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [agent.id]);

  const attached = useMemo(() => new Set(items?.map((item) => item.fileId)), [items]);

  const docs = useMemo(() => {
    const all: Doc[] = [];
    for (const workspace of workspaces) {
      const folders = new Map(workspace.folders.map((folder) => [folder.id, folder.name]));
      const files = [...workspace.files, ...workspace.folders.flatMap((folder) => folder.files)];
      for (const file of files) {
        all.push({
          id: file.id,
          title: file.title,
          excerpt: file.excerpt,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          folderName: file.folderId ? folders.get(file.folderId) ?? null : null,
          updatedAt: file.updatedAt,
        });
      }
    }
    const term = query.trim().toLowerCase();
    return all
      .filter(
        (doc) =>
          !term ||
          doc.title.toLowerCase().includes(term) ||
          doc.excerpt.toLowerCase().includes(term) ||
          doc.workspaceName.toLowerCase().includes(term)
      )
      .sort(
        (a, b) =>
          Number(b.workspaceId === agent.room?.id) - Number(a.workspaceId === agent.room?.id) ||
          b.updatedAt.localeCompare(a.updatedAt)
      );
  }, [workspaces, query, agent.room?.id]);

  async function attach(fileId: string) {
    setBusy(fileId);
    setError(null);
    try {
      const result = await apiPost<{ items: AgentKnowledgeItem[] }>(`/api/agents/${agent.id}/knowledge`, { fileId });
      setItems(result.items);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao anexar");
    } finally {
      setBusy(null);
    }
  }

  async function detach(fileId: string) {
    setBusy(fileId);
    setError(null);
    try {
      const result = await apiDelete<{ items: AgentKnowledgeItem[] }>(`/api/agents/${agent.id}/knowledge/${fileId}`);
      setItems(result.items);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao remover");
    } finally {
      setBusy(null);
    }
  }

  async function createDoc(event: React.FormEvent) {
    event.preventDefault();
    if (!agent.room || busy) return;
    setBusy("new");
    setError(null);
    try {
      const result = await apiPost<{ fileId: string; items: AgentKnowledgeItem[] }>(
        `/api/agents/${agent.id}/knowledge`,
        { title: newTitle.trim() || `Referências de ${name}` }
      );
      setItems(result.items);
      onChanged();
      await reloadWorkspaces();
      router.push(fileHref(agent.room.id, result.fileId, { editar: true }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao criar o documento");
      setBusy(null);
    }
  }

  const shown = docs.slice(0, PICKER_LIMIT);

  const body = (
    <>
      <p className="text-xs leading-relaxed text-[var(--muted)]">
        São os documentos que {name} usa como referência. Quando a IA estiver ligada (etapa 4), as respostas de {name} vão
        se basear no que estiver aqui.
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nesta base</h3>
      {items === null ? (
        <p className="mt-2 text-sm text-[var(--muted)]">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted)]">
          Nenhum documento ainda. Crie um abaixo ou anexe um que você já tem.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.fileId} className="flex items-start gap-2 rounded-xl border border-[var(--border)] px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <Link
                  href={fileHref(item.workspaceId, item.fileId)}
                  className="flex items-center gap-1 truncate text-sm font-medium text-[var(--foreground)] hover:underline"
                >
                  <span className="truncate">{item.title}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                </Link>
                <p className="truncate text-[11px] text-[var(--muted)]">
                  {item.kind ?? "contexto"} · {item.indexStatus ?? "pending"} · {item.workspaceName}
                  {item.folderName ? ` · ${item.folderName}` : ""} · {formatDateTime(item.updatedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setBusy(`reindex-${item.fileId}`);
                  try {
                    await apiPost("/api/knowledge/reindex", { fileId: item.fileId });
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : "Falha ao reindexar");
                  } finally {
                    setBusy(null);
                  }
                }}
                disabled={Boolean(busy)}
                className="text-[11px] text-[var(--brand-600)]"
              >
                reindex
              </button>
              <button
                type="button"
                onClick={() => detach(item.fileId)}
                disabled={busy === item.fileId}
                title="Tirar da base (o documento continua no espaço)"
                aria-label={`Tirar ${item.title} da base`}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {agent.room && (
        <form onSubmit={createDoc} className="mt-5 rounded-xl bg-[#f6f7f9] p-3">
          <label htmlFor="kb-new" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Novo documento na base
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="kb-new"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              maxLength={TITLE_MAX_LENGTH}
              placeholder={`Referências de ${name}`}
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white px-3 text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            />
            <button
              type="submit"
              disabled={busy === "new"}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#15171c] px-3 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
            >
              <FilePlus className="h-3.5 w-3.5" /> Criar e abrir
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--muted)]">Fica na pasta “Base de conhecimento” da sala de {name}.</p>
        </form>
      )}

      <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Anexar documentos existentes</h3>
      <label className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 focus-within:border-[var(--brand)]">
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar em todos os espaços"
          className="min-h-10 w-full bg-transparent text-[var(--foreground)] outline-none placeholder:text-slate-400"
        />
      </label>
      {docs.length === 0 ? (
        <p className="mt-3 text-center text-xs text-[var(--muted)]">
          {query ? "Nenhum documento encontrado." : "Ainda não há documentos nos Espaços de Trabalho."}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {shown.map((doc) => {
            const isAttached = attached.has(doc.id);
            return (
              <li key={doc.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-[var(--foreground)]">{doc.title}</p>
                  <p className="truncate text-[11px] text-[var(--muted)]">
                    {doc.workspaceName}
                    {doc.folderName ? ` · ${doc.folderName}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => (isAttached ? detach(doc.id) : attach(doc.id))}
                  disabled={busy === doc.id || items === null}
                  className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    isAttached
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border border-[var(--border)] text-slate-700 hover:bg-black/[0.03]"
                  }`}
                >
                  {isAttached ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                  {isAttached ? "Na base" : "Anexar"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {docs.length > PICKER_LIMIT && (
        <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
          Mostrando {PICKER_LIMIT} de {docs.length}. Busque para achar outros.
        </p>
      )}
    </>
  );

  if (embedded) return <div className="px-4 pb-4">{body}</div>;

  return (
    <Drawer
      title={`Base de conhecimento · ${name}`}
      subtitle={`${items?.length ?? "…"} ${items?.length === 1 ? "documento" : "documentos"} como referência`}
      icon={
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand-600)]">
          <BookOpen className="h-4 w-4" />
        </span>
      }
      onClose={onClose}
    >
      {body}
    </Drawer>
  );
}
