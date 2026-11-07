"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import Drawer from "@/components/office/ui/Drawer";
import KnowledgePanel from "@/components/office/ui/KnowledgePanel";
import { apiGet, apiPatch, apiPost } from "@/lib/fetcher";
import { fileHref } from "@/lib/workspaces";
import { LAYER_LABELS, type PromptLayer } from "@/lib/knowledge/kinds";
import type { Agent } from "@/lib/types";

type Tab = "visao" | "prompt" | "base" | "propostas" | "historico" | "testar";

const TABS: { id: Tab; label: string }[] = [
  { id: "visao", label: "Visão geral" },
  { id: "prompt", label: "Prompt" },
  { id: "base", label: "Base" },
  { id: "propostas", label: "Propostas" },
  { id: "historico", label: "Histórico" },
  { id: "testar", label: "Testar" },
];

export default function AgentStudio({
  agent,
  onClose,
  onChanged,
}: {
  agent: Agent;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("base");
  const [pending, setPending] = useState(0);

  useEffect(() => {
    apiGet<{ id: string }[]>(`/api/proposals?agentId=${agent.id}&status=pending`)
      .then((rows) => setPending(rows.length))
      .catch(() => setPending(0));
  }, [agent.id, tab]);

  return (
    <Drawer
      wide
      title={agent.name}
      subtitle={`${agent.role || "Agente"} · ${agent.knowledgeCount} docs`}
      icon={
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand-600)]">
          <BookOpen className="h-4 w-4" />
        </span>
      }
      onClose={onClose}
    >
      <div className="-mx-4 mb-3 flex gap-1 overflow-x-auto border-b border-[var(--border)] px-4">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`-mb-px shrink-0 border-b-2 px-2.5 py-2 text-xs font-medium ${tab === item.id ? "border-[var(--brand)] text-[var(--brand-600)]" : "border-transparent text-[var(--muted)]"}`}
          >
            {item.label}
            {item.id === "propostas" && pending > 0 ? ` (${pending})` : ""}
          </button>
        ))}
      </div>
      {tab === "visao" && <Overview agent={agent} />}
      {tab === "prompt" && <PromptTab agentId={agent.id} />}
      {tab === "base" && (
        <div className="-mx-4 -mb-4">
          <KnowledgePanel agent={agent} onClose={onClose} onChanged={onChanged} embedded />
        </div>
      )}
      {tab === "propostas" && <ProposalsTab agentId={agent.id} onChanged={onChanged} />}
      {tab === "historico" && <HistoryTab agent={agent} />}
      {tab === "testar" && <TestTab agent={agent} />}
    </Drawer>
  );
}

function Overview({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-2 text-sm text-slate-700">
      <p>{agent.description || "Sem descrição."}</p>
      <p className="text-xs text-[var(--muted)]">Sala: {agent.room?.name ?? "—"} · {agent.knowledgeCount} docs na base</p>
      {agent.room && (
        <Link href={`/espacos/${agent.room.id}`} className="text-xs font-medium text-[var(--brand-600)] hover:underline">
          Abrir sala
        </Link>
      )}
    </div>
  );
}

function PromptTab({ agentId }: { agentId: string }) {
  const [layers, setLayers] = useState<{ id: string; layer: string; enabled: boolean; order: number; file: { id: string; title: string; workspaceId: string } }[]>([]);
  const [composed, setComposed] = useState("");
  const [versions, setVersions] = useState<{ id: string; version: number; note: string | null; createdAt: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [l, p, v] = await Promise.all([
      apiGet<typeof layers>(`/api/agents/${agentId}/prompt/layers`),
      apiGet<{ composed: string }>(`/api/agents/${agentId}/prompt`),
      apiGet<{ id: string; version: number; note: string | null; createdAt: string }[]>(`/api/agents/${agentId}/prompt/versions`),
    ]);
    setLayers(l);
    setComposed(p.composed);
    setVersions(v);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [agentId]);

  async function publish() {
    setBusy(true);
    try {
      await apiPost(`/api/agents/${agentId}/prompt`, { note: "publicado pela UI" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, enabled: boolean) {
    await apiPatch(`/api/agents/${agentId}/prompt/layers`, { layers: [{ id, enabled }] });
    await load();
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void publish()}
        disabled={busy}
        className="mb-3 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
      >
        Publicar nova versão
      </button>
      <ul className="space-y-2">
        {layers.map((layer) => (
          <li key={layer.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
            <input type="checkbox" checked={layer.enabled} onChange={(e) => void toggle(layer.id, e.target.checked)} />
            <span className="min-w-0 flex-1 truncate">
              {LAYER_LABELS[layer.layer as PromptLayer] ?? layer.layer} · {layer.file.title}
            </span>
            <Link href={fileHref(layer.file.workspaceId, layer.file.id)} className="text-xs text-[var(--brand-600)]">
              abrir
            </Link>
          </li>
        ))}
      </ul>
      {layers[0] && (
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Abra a camada no editor da sala do agente (pasta Prompt).
        </p>
      )}
      <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-[#f6f7f9] p-3 text-[11px]">{composed || "Sem prompt composto ainda."}</pre>
      <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Versões</h4>
      <ul className="mt-1 space-y-1">
        {versions.map((ver) => (
          <li key={ver.id} className="flex items-center justify-between text-xs">
            <span>v{ver.version} · {ver.note || "sem nota"}</span>
            <button
              type="button"
              className="text-[var(--brand-600)]"
              onClick={async () => {
                await apiPost(`/api/agents/${agentId}/prompt/versions`, { versionId: ver.id });
                await load();
              }}
            >
              rollback
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProposalsTab({ agentId, onChanged }: { agentId: string; onChanged: () => void }) {
  const [rows, setRows] = useState<{ id: string; title: string; status: string; diffText: string; rationale: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRows(await apiGet(`/api/proposals?agentId=${agentId}`));
  }
  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "erro"));
  }, [agentId]);

  async function act(id: string, kind: "apply" | "reject") {
    setError(null);
    try {
      await apiPost(`/api/proposals/${id}/${kind}`, {});
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "falha");
    }
  }

  return (
    <div>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">Nenhuma proposta.</p>
      ) : (
        rows.map((row) => (
          <article key={row.id} className="mb-3 rounded-xl border border-[var(--border)] p-3">
            <h4 className="text-sm font-medium">{row.title} <span className="text-[11px] text-[var(--muted)]">{row.status}</span></h4>
            <p className="mt-1 text-xs text-[var(--muted)]">{row.rationale}</p>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap bg-[#f6f7f9] p-2 text-[10px]">{row.diffText}</pre>
            {row.status === "pending" && (
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => void act(row.id, "apply")} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white">Aplicar</button>
                <button type="button" onClick={() => void act(row.id, "reject")} className="rounded-lg border px-2 py-1 text-xs">Rejeitar</button>
              </div>
            )}
          </article>
        ))
      )}
    </div>
  );
}

function HistoryTab({ agent }: { agent: Agent }) {
  const [files, setFiles] = useState<{ fileId: string; title: string; workspaceId: string; updatedAt: string }[]>([]);
  useEffect(() => {
    apiGet<typeof files>(`/api/agents/${agent.id}/knowledge`)
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [agent.id]);
  return (
    <ul className="space-y-2 text-sm">
      {files.length === 0 && <li className="text-xs text-[var(--muted)]">Nenhum arquivo na base ainda.</li>}
      {files.map((f) => (
        <li key={f.fileId}>
          <Link href={fileHref(f.workspaceId, f.fileId)} className="text-[var(--brand-600)] hover:underline">
            {f.title}
          </Link>
          <span className="ml-2 text-[11px] text-[var(--muted)]">{new Date(f.updatedAt).toLocaleString("pt-BR")}</span>
        </li>
      ))}
    </ul>
  );
}

function TestTab({ agent }: { agent: Agent }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ title: string; headingPath: string; content: string; score: number }[]>([]);
  const [busy, setBusy] = useState(false);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await apiGet<typeof hits>(`/api/knowledge/search?q=${encodeURIComponent(q)}&agent=${agent.id}`);
      setHits(data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void run(e)}>
      <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3} placeholder="Pergunte à base…" className="w-full rounded-lg border border-[var(--border)] p-2 text-sm" />
      <button type="submit" disabled={busy || !q.trim()} className="mt-2 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs text-white disabled:opacity-60">
        Buscar trechos
      </button>
      <ul className="mt-3 space-y-2">
        {hits.map((hit, i) => (
          <li key={i} className="rounded-lg border border-[var(--border)] p-2 text-xs">
            <p className="font-medium">{hit.title} {hit.headingPath ? `· ${hit.headingPath}` : ""} <span className="text-[var(--muted)]">{hit.score.toFixed(3)}</span></p>
            <p className="mt-1 line-clamp-4 text-[var(--muted)]">{hit.content}</p>
          </li>
        ))}
      </ul>
    </form>
  );
}
