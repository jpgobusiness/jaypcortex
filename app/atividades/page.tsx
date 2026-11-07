"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Check,
  Trash2,
  List,
  LayoutGrid,
  RotateCcw,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/form";
import { StatusBadge, PriorityBadge } from "@/components/activities/badges";
import ActivityModal from "@/components/activities/ActivityModal";
import KanbanBoard from "@/components/activities/KanbanBoard";
import PriorityQueue from "@/components/activities/PriorityQueue";
import ActivityMindMap from "@/components/activities/ActivityMindMap";
import TodayBriefing from "@/components/activities/TodayBriefing";
import { apiGet, apiPatch, apiDelete, apiPost } from "@/lib/fetcher";
import { formatDate } from "@/lib/format";
import type { Activity, ActivityStatusDef, ActivityType } from "@/lib/types";

type Section = "map" | "activities";

function sectionFromParam(value: string | null): Section {
  if (value === "mapa") return "map";
  return "activities";
}

export default function AtividadesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [statuses, setStatuses] = useState<ActivityStatusDef[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const section = sectionFromParam(searchParams.get("secao"));
  const [tab, setTab] = useState<string>("queue");
  const [view, setView] = useState<"list" | "kanban">("list");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [trash, setTrash] = useState<Activity[]>([]);

  const loadActivities = useCallback(async () => {
    setActivities(await apiGet<Activity[]>("/api/activities"));
    if (tab === "trash") {
      setTrash(await apiGet<Activity[]>("/api/activities/trash"));
    }
  }, [tab]);

  const reload = useCallback(async () => {
    await loadActivities();
  }, [loadActivities]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, t, st] = await Promise.all([
        apiGet<Activity[]>("/api/activities"),
        apiGet<ActivityType[]>("/api/activity-types"),
        apiGet<ActivityStatusDef[]>("/api/activity-statuses"),
      ]);
      setActivities(a);
      setTypes(t);
      setStatuses(st);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (tab !== "trash") return;
    apiGet<Activity[]>("/api/activities/trash")
      .then(setTrash)
      .catch(() => setTrash([]));
  }, [tab]);

  const statusByKey = useMemo(
    () => new Map(statuses.map((s) => [s.key, s])),
    [statuses]
  );

  const filtered = useMemo(
    () =>
      tab === "all" || tab === "queue" || tab === "trash"
        ? activities
        : activities.filter((a) => a.status === tab),
    [activities, tab]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: activities.length };
    for (const s of statuses) c[s.key] = 0;
    for (const a of activities) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [activities, statuses]);

  async function toggle(a: Activity) {
    const currentIsDone = statusByKey.get(a.status)?.isDone ?? false;
    const doneStatus = statuses.find((s) => s.isDone);
    const openStatus = statuses.find((s) => !s.isDone);
    const next = currentIsDone ? openStatus?.key : doneStatus?.key;
    if (!next) return;
    await apiPatch(`/api/activities/${a.id}`, { status: next });
    await reload();
  }

  async function remove(a: Activity) {
    if (!confirm(`Enviar "${a.title}" para a lixeira? Dá para restaurar.`)) return;
    await apiDelete(`/api/activities/${a.id}`);
    await reload();
  }

  async function restore(a: Activity) {
    await apiPost(`/api/activities/${a.id}/restore`, {});
    await reload();
  }

  function openActivityEdit(a: Activity) {
    setEditing(a);
    setModalOpen(true);
  }

  function openNewActivity() {
    setEditing(null);
    setModalOpen(true);
  }

  return (
    <div className={section === "map" ? "flex min-h-0 flex-1 flex-col" : undefined}>
      <PageHeader
        title="Atividades"
        actions={
          <Button onClick={openNewActivity}>
            <Plus className="h-4 w-4" /> Nova atividade
          </Button>
        }
      />

      <div className={section === "map" ? "flex min-h-0 flex-1 flex-col" : "p-4 sm:p-6"}>
        {section === "map" && (
          <ActivityMindMap
            activities={activities}
            types={types}
            statuses={statuses}
            onActivitiesChanged={reload}
          />
        )}

        {section === "activities" && (
          <>
            <TodayBriefing
              onOpen={(id) => {
                const found = activities.find((a) => a.id === id);
                if (found) openActivityEdit(found);
              }}
            />
            <ActivitiesSection
            loading={loading}
            tab={tab}
            setTab={setTab}
            view={view}
            setView={setView}
            counts={counts}
            statuses={statuses}
            statusByKey={statusByKey}
            filtered={filtered}
            activities={activities}
            trash={trash}
            onToggle={toggle}
            onRemove={remove}
            onRestore={restore}
            onEdit={openActivityEdit}
            onReload={reload}
          />
          </>
        )}
      </div>

      <ActivityModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={reload}
        types={types}
        statuses={statuses}
        activity={editing}
      />
    </div>
  );
}

/* ---------------- Aba: Atividades (Lista/Kanban) ---------------- */

function ActivitiesSection({ loading, tab, setTab, view, setView, counts, statuses, statusByKey, filtered, activities, trash, onToggle, onRemove, onRestore, onEdit, onReload }: {
  loading: boolean; tab: string; setTab: (t: string) => void; view: "list" | "kanban"; setView: (v: "list" | "kanban") => void;
  counts: Record<string, number>; statuses: ActivityStatusDef[]; statusByKey: Map<string, ActivityStatusDef>;
  filtered: Activity[]; activities: Activity[]; trash: Activity[]; onToggle: (a: Activity) => void; onRemove: (a: Activity) => void; onRestore: (a: Activity) => void; onEdit: (a: Activity) => void; onReload: () => void;
}) {
  const queueCount = activities.filter((a) => a.queueOrder != null).length;
  const tabs = [
    { key: "queue", label: "Fila" },
    { key: "all", label: "Todas" },
    ...statuses.map((s) => ({ key: s.key, label: s.name })),
    { key: "trash", label: "Lixeira" },
  ];
  const showQueue = tab === "queue";
  const showTrash = tab === "trash";

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 border-b border-[var(--border)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="-mx-4 scroll-x-fade px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${tab === t.key ? "border-[var(--brand)] text-[var(--brand-600)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
              {t.label}
              <span className="ml-1.5 rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[11px]">{t.key === "queue" ? queueCount : t.key === "trash" ? trash.length : (counts[t.key] ?? 0)}</span>
            </button>
          ))}
          </div>
        </div>
        {!showQueue && !showTrash && (
        <div className="mb-2 flex w-full items-center gap-1 rounded-lg border border-[var(--border)] bg-white p-0.5 sm:w-auto">
          <button onClick={() => setView("list")} className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex-none ${view === "list" ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
            <List className="h-4 w-4" /> Lista
          </button>
          <button onClick={() => setView("kanban")} className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex-none ${view === "kanban" ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
            <LayoutGrid className="h-4 w-4" /> Kanban
          </button>
        </div>
        )}
      </div>

      {showQueue ? (
        loading ? <p className="py-10 text-center text-[var(--muted)]">Carregando...</p> : (
          <PriorityQueue
            activities={activities}
            statuses={statuses}
            onChanged={onReload}
          />
        )
      ) : showTrash ? (
        loading ? <p className="py-10 text-center text-[var(--muted)]">Carregando...</p> : trash.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] py-10 text-center text-[var(--muted)]">Lixeira vazia.</p>
        ) : (
          <div className="space-y-2">
            {trash.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--muted)]">{a.title}</p>
                  {a.source && a.source !== "ui" ? <p className="text-[11px] text-[var(--muted)]">Origem: {a.source}</p> : null}
                </div>
                <button onClick={() => onRestore(a)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-xs font-medium text-[var(--brand-600)] hover:bg-black/[0.04]">
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                </button>
              </div>
            ))}
          </div>
        )
      ) : view === "kanban" ? (
        loading ? <p className="py-10 text-center text-[var(--muted)]">Carregando...</p> : (
          <KanbanBoard activities={activities} statuses={statuses} onChanged={onReload} onEdit={onEdit} />
        )
      ) : (
        <div className="space-y-2">
          {loading ? (
            <p className="py-10 text-center text-[var(--muted)]">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] py-10 text-center text-[var(--muted)]">Nenhuma atividade nesta visão.</p>
          ) : (
            filtered.map((a) => {
              const sdef = statusByKey.get(a.status);
              const done = sdef?.isDone ?? false;
              return (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
                  <button onClick={() => onToggle(a)} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${done ? "border-green-500 bg-green-500 text-white" : "border-slate-300 hover:border-[var(--brand)]"}`}>
                    {done && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onEdit(a)} className={`block text-left font-medium hover:underline ${done ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"}`}>
                      {a.title}
                    </button>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                      {a.type && (<span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${a.type.color}1a`, color: a.type.color }}>{a.type.name}</span>)}
                      {sdef && <StatusBadge name={sdef.name} color={sdef.color} />}
                      <PriorityBadge priority={a.priority} />
                      {a.dueDate && (<span className="text-[11px] text-[var(--muted)]">Prazo: {formatDate(a.dueDate)}</span>)}
                    </div>
                  </div>
                  <button onClick={() => onRemove(a)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
