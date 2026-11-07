"use client";

import { useEffect, useState } from "react";
import { Trash2, Link2, GripVertical } from "lucide-react";
import { PriorityBadge } from "@/components/activities/badges";
import { apiPatch, apiDelete } from "@/lib/fetcher";
import { formatDate } from "@/lib/format";
import type { Activity, ActivityStatusDef } from "@/lib/types";

type Props = {
  activities: Activity[];
  statuses: ActivityStatusDef[];
  onChanged: () => void;
  onEdit: (a: Activity) => void;
};

export default function KanbanBoard({
  activities,
  statuses,
  onChanged,
  onEdit,
}: Props) {
  const [items, setItems] = useState<Activity[]>(activities);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  useEffect(() => {
    setItems(activities);
  }, [activities]);

  async function moveTo(id: string, statusKey: string) {
    const current = items.find((a) => a.id === id);
    if (!current || current.status === statusKey) return;

    const isDone = statuses.find((s) => s.key === statusKey)?.isDone ?? false;

    setItems((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: statusKey,
              completedAt: isDone ? new Date().toISOString() : null,
            }
          : a
      )
    );

    try {
      await apiPatch(`/api/activities/${id}`, { status: statusKey });
    } finally {
      onChanged();
    }
  }

  async function remove(a: Activity) {
    if (!confirm(`Excluir a atividade "${a.title}"?`)) return;
    setItems((prev) => prev.filter((x) => x.id !== a.id));
    try {
      await apiDelete(`/api/activities/${a.id}`);
    } finally {
      onChanged();
    }
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 scroll-x-fade sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${Math.max(
            statuses.length,
            1
          )}, minmax(260px, 1fr))`,
          width: `max(100%, ${Math.max(statuses.length, 1) * 272}px)`,
        }}
      >
        {statuses.map((col) => {
          const cards = items.filter((a) => a.status === col.key);
          const isOver = overCol === col.key;
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setOverCol((c) => (c === col.key ? null : c));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || draggingId;
                if (id) moveTo(id, col.key);
                setOverCol(null);
                setDraggingId(null);
              }}
              className={`flex snap-start flex-col rounded-2xl border bg-black/[0.015] transition-colors ${
                isOver
                  ? "border-[var(--brand)] bg-[var(--brand)]/[0.06]"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {col.name}
                  </span>
                </div>
                <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
                  {cards.length}
                </span>
              </div>

              <div className="flex min-h-24 flex-1 flex-col gap-2 px-3 pb-3">
                {cards.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border)] py-8 text-xs text-[var(--muted)]">
                    <span className="hidden md:inline">Arraste aqui</span>
                    <span className="md:hidden">Vazio</span>
                  </div>
                ) : (
                  cards.map((a) => (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(a.id);
                        e.dataTransfer.setData("text/plain", a.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverCol(null);
                      }}
                      className={`group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm transition-all ${
                        draggingId === a.id ? "opacity-50" : "hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 hidden h-4 w-4 shrink-0 cursor-grab text-slate-300 group-hover:text-slate-400 active:cursor-grabbing md:block" />
                        <div className="min-w-0 flex-1">
                          <button
                            onClick={() => onEdit(a)}
                            className={`block text-left text-sm font-medium hover:underline ${
                              col.isDone
                                ? "text-[var(--muted)] line-through"
                                : "text-[var(--foreground)]"
                            }`}
                          >
                            {a.title}
                          </button>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
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
                            <PriorityBadge priority={a.priority} />
                          </div>

                          {/* Fallback touch: mudar status sem drag */}
                          <label className="mt-2 block md:hidden">
                            <span className="sr-only">Mover para status</span>
                            <select
                              value={a.status}
                              onChange={(e) => moveTo(a.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full rounded-lg border border-[var(--border)] bg-white px-2 py-2 text-sm outline-none focus:border-[var(--brand)]"
                            >
                              {statuses.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          {(a.opportunity || a.dueDate) && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2 text-[11px] text-[var(--muted)]">
                              {a.opportunity && (
                                <span className="inline-flex items-center gap-1">
                                  <Link2 className="h-3 w-3" />
                                  {a.opportunity.name}
                                </span>
                              )}
                              {a.dueDate && (
                                <span>Prazo: {formatDate(a.dueDate)}</span>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => remove(a)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-1 text-[var(--muted)] hover:bg-red-50 hover:text-red-600 md:h-auto md:w-auto md:opacity-0 md:group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
