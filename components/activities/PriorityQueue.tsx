"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ListPlus,
  GripVertical,
  Check,
  X,
  Play,
  Pause,
  Link2,
  Search,
  ListChecks,
  Flame,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/form";
import { PriorityBadge } from "@/components/activities/badges";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/fetcher";
import { formatDate } from "@/lib/format";
import type { Activity, ActivityStatusDef } from "@/lib/types";

// Escala de cores por posição (1 = "faça agora").
const RANK_COLORS = [
  "#16a34a",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
];
function rankColor(index: number): string {
  return RANK_COLORS[Math.min(index, RANK_COLORS.length - 1)];
}

type Props = {
  activities: Activity[];
  statuses: ActivityStatusDef[];
  onChanged: () => void;
};

export default function PriorityQueue({
  activities,
  statuses,
  onChanged,
}: Props) {
  const statusByKey = useMemo(
    () => new Map(statuses.map((s) => [s.key, s])),
    [statuses]
  );
  const doneStatus = useMemo(() => statuses.find((s) => s.isDone), [statuses]);
  const inProgressKeys = useMemo(
    () => new Set(statuses.filter((s) => s.isInProgress || s.key === "in_progress").map((s) => s.key)),
    [statuses]
  );

  const queue = useMemo(
    () =>
      activities
        .filter((a) => a.queueOrder != null)
        .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0)),
    [activities]
  );

  const candidates = useMemo(
    () =>
      activities.filter(
        (a) =>
          a.queueOrder == null &&
          !(statusByKey.get(a.status)?.isDone ?? false)
      ),
    [activities, statusByKey]
  );

  const [ordered, setOrdered] = useState<Activity[]>(queue);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    setOrdered(queue);
  }, [queue]);

  async function persistOrder(ids: string[]) {
    await apiPatch("/api/activities/queue", { orderedIds: ids });
    onChanged();
  }

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    const ids = ordered.map((a) => a.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggingId);
    const map = new Map(ordered.map((a) => [a.id, a]));
    setOrdered(ids.map((id) => map.get(id)!).filter(Boolean));
    persistOrder(ids);
  }

  function moveBy(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= ordered.length) return;
    const ids = ordered.map((a) => a.id);
    const [item] = ids.splice(index, 1);
    ids.splice(to, 0, item);
    const map = new Map(ordered.map((a) => [a.id, a]));
    setOrdered(ids.map((id) => map.get(id)!).filter(Boolean));
    persistOrder(ids);
  }

  async function startOrPause(a: Activity) {
    const running = inProgressKeys.has(a.status);
    await apiPost(`/api/activities/${a.id}/${running ? "pause" : "start"}`, {});
    onChanged();
  }

  async function complete(a: Activity) {
    if (!doneStatus) {
      alert("Nenhum status marcado como 'Conclui a atividade' em Configurações.");
      return;
    }
    setOrdered((prev) => prev.filter((x) => x.id !== a.id));
    try {
      await apiPost(`/api/activities/${a.id}/complete`, {});
    } catch {
      await apiPatch(`/api/activities/${a.id}`, { status: doneStatus.key });
    }
    onChanged();
  }

  async function removeFromQueue(a: Activity) {
    setOrdered((prev) => prev.filter((x) => x.id !== a.id));
    await apiDelete(`/api/activities/queue?id=${a.id}`);
    onChanged();
  }

  async function addSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    await apiPost("/api/activities/queue", { ids });
    setImportOpen(false);
    setSelected(new Set());
    setSearch("");
    onChanged();
  }

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.opportunity?.name ?? "").toLowerCase().includes(q)
    );
  }, [candidates, search]);

  return (
    <div>
      {/* Barra de ações */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
            <Flame className="h-5 w-5 text-orange-500" />
            Fila de execução
          </h2>
          <p className="text-sm text-[var(--muted)]">
            {ordered.length > 0
              ? `${ordered.length} atividade(s) na fila · execute de cima para baixo`
              : "Importe atividades e ordene por prioridade."}
          </p>
        </div>
        <Button
          onClick={() => {
            setSelected(new Set());
            setSearch("");
            setImportOpen(true);
          }}
        >
          <ListPlus className="h-4 w-4" /> Importar atividades
        </Button>
      </div>

      {/* Fila */}
      {ordered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] py-16 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)]/10 text-[var(--brand-600)]">
            <ListChecks className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-[var(--foreground)]">
            Sua fila está vazia
          </p>
          <p className="mb-4 mt-1 max-w-sm text-sm text-[var(--muted)]">
            Clique em &quot;Importar atividades&quot; para trazer as atividades
            não concluídas e montar sua ordem de prioridade.
          </p>
          <Button
            onClick={() => {
              setSelected(new Set());
              setImportOpen(true);
            }}
          >
            <ListPlus className="h-4 w-4" /> Importar atividades
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {ordered.map((a, i) => {
            const color = rankColor(i);
            const isNext = i === 0;
            const sdef = statusByKey.get(a.status);
            const isOver = overId === a.id && draggingId !== a.id;
            return (
              <div
                key={a.id}
                draggable
                onDragStart={(e) => {
                  setDraggingId(a.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setOverId(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverId(a.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(a.id);
                  setOverId(null);
                }}
                className={`group relative flex flex-col gap-3 rounded-2xl border p-3 transition-all sm:flex-row sm:items-center ${
                  draggingId === a.id ? "opacity-40" : ""
                } ${
                  isOver ? "ring-2 ring-[var(--brand)]" : ""
                }`}
                style={{
                  borderColor: isNext ? color : "var(--border)",
                  borderLeftWidth: 5,
                  borderLeftColor: color,
                  background: isNext
                    ? `linear-gradient(90deg, ${color}14, transparent 60%)`
                    : "var(--surface)",
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                {/* Rank */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm"
                  style={{ backgroundColor: color }}
                >
                  {i + 1}
                </div>

                {/* Handle desktop */}
                <GripVertical className="hidden h-5 w-5 shrink-0 cursor-grab text-slate-300 group-hover:text-slate-400 active:cursor-grabbing md:block" />

                {/* Setas mobile */}
                <div className="flex shrink-0 flex-col md:hidden">
                  <button
                    type="button"
                    onClick={() => moveBy(i, -1)}
                    disabled={i === 0}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-black/[0.05] disabled:opacity-30"
                    aria-label="Subir na fila"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBy(i, 1)}
                    disabled={i === ordered.length - 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-black/[0.05] disabled:opacity-30"
                    aria-label="Descer na fila"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                {/* Conteúdo */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {isNext && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                        style={{ backgroundColor: color }}
                      >
                        <Play className="h-2.5 w-2.5" /> Próxima
                      </span>
                    )}
                    <p className="font-medium text-[var(--foreground)] sm:truncate">
                      {a.title}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {a.type && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: `${a.type.color}1a`,
                          color: a.type.color,
                        }}
                      >
                        {a.type.name}
                      </span>
                    )}
                    {sdef && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: `${sdef.color}1a`,
                          color: sdef.color,
                        }}
                      >
                        {sdef.name}
                      </span>
                    )}
                    <PriorityBadge priority={a.priority} />
                    {a.opportunity && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
                        <Link2 className="h-3 w-3" />
                        {a.opportunity.name}
                      </span>
                    )}
                    {a.dueDate && (
                      <span className="text-[11px] text-[var(--muted)]">
                        Prazo: {formatDate(a.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
                </div>

                {/* Ações */}
                <div className="flex shrink-0 items-center gap-1 self-stretch sm:self-auto">
                  <button
                    onClick={() => startOrPause(a)}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700 sm:flex-none sm:px-2.5 sm:py-1.5"
                    title={inProgressKeys.has(a.status) ? "Pausar" : "Iniciar"}
                  >
                    {inProgressKeys.has(a.status) ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {inProgressKeys.has(a.status) ? "Pausar" : "Iniciar"}
                  </button>
                  <button
                    onClick={() => complete(a)}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-green-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-green-600 sm:flex-none sm:px-2.5 sm:py-1.5"
                    title="Concluir"
                  >
                    <Check className="h-3.5 w-3.5" /> Concluir
                  </button>
                  <button
                    onClick={() => removeFromQueue(a)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
                    title="Remover da fila"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de importação */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar atividades para a fila"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addSelected} disabled={selected.size === 0}>
              <ListPlus className="h-4 w-4" /> Adicionar ({selected.size})
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por atividade ou oportunidade..."
              className="w-full rounded-lg border border-[var(--border)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
            />
          </div>

          {filteredCandidates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] py-8 text-center text-sm text-[var(--muted)]">
              Nenhuma atividade não concluída disponível para adicionar.
            </p>
          ) : (
            <>
              <button
                onClick={() => {
                  if (selected.size === filteredCandidates.length) {
                    setSelected(new Set());
                  } else {
                    setSelected(new Set(filteredCandidates.map((a) => a.id)));
                  }
                }}
                className="text-xs font-medium text-[var(--brand-600)] hover:underline"
              >
                {selected.size === filteredCandidates.length
                  ? "Desmarcar todas"
                  : "Selecionar todas"}
              </button>
              <div className="max-h-80 space-y-1.5 overflow-y-auto">
                {filteredCandidates.map((a) => {
                  const checked = selected.has(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(a.id)) next.delete(a.id);
                          else next.add(a.id);
                          return next;
                        });
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                        checked
                          ? "border-[var(--brand)] bg-[var(--brand)]/[0.06]"
                          : "border-[var(--border)] hover:bg-black/[0.02]"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                            : "border-slate-300"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">
                          {a.title}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          {a.type && (
                            <span className="text-[11px] text-[var(--muted)]">
                              {a.type.name}
                            </span>
                          )}
                          {a.opportunity && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
                              <Link2 className="h-3 w-3" />
                              {a.opportunity.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <PriorityBadge priority={a.priority} />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
