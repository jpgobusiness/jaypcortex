"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  Check,
  Percent,
  Flame,
  CalendarDays,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import { Button, Input } from "@/components/ui/form";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/fetcher";
import {
  currentMonthKey,
  shiftMonthKey,
  monthLabel,
  heatmapColor,
  formatDayLabel,
  dayLabelParts,
} from "@/lib/daily";

type Habit = {
  id: string;
  name: string;
  order: number;
  active: boolean;
};

type DayRow = {
  id: string;
  day: number;
  date: string;
  monthKey: string;
  checks: Record<string, boolean>;
  score: number | null;
  isFuture: boolean;
};

type MonthPayload = {
  monthKey: string;
  habits: Habit[];
  activeHabits: Habit[];
  days: DayRow[];
  metrics: {
    avgCompletion: number;
    perfectDays: number;
  };
};

export default function ControleDiarioPage() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [data, setData] = useState<MonthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [habitsOpen, setHabitsOpen] = useState(false);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    try {
      setData(await apiGet<MonthPayload>(`/api/daily/month/${key}`));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(monthKey);
  }, [monthKey, load]);

  async function toggleCheck(day: DayRow, habitId: string) {
    if (day.isFuture || !data) return;
    const next = !day.checks[habitId];
    // Otimista
    setData((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((d) => {
        if (d.id !== day.id) return d;
        const checks = { ...d.checks, [habitId]: next };
        const done = prev.activeHabits.filter((h) => checks[h.id]).length;
        const score =
          prev.activeHabits.length === 0
            ? 0
            : (done / prev.activeHabits.length) * 100;
        return { ...d, checks, score };
      });
      const scored = days.filter((d) => d.score !== null);
      const avgCompletion =
        scored.length === 0
          ? 0
          : scored.reduce((s, d) => s + (d.score ?? 0), 0) / scored.length;
      const perfectDays = scored.filter((d) => (d.score ?? 0) >= 100).length;
      return {
        ...prev,
        days,
        metrics: { avgCompletion, perfectDays },
      };
    });

    try {
      await apiPatch("/api/daily/checks", {
        date: day.date,
        habitId,
        done: next,
      });
    } catch {
      await load(monthKey);
    }
  }

  const activeHabits = data?.activeHabits ?? [];

  return (
    <div>
      <PageHeader
        title="Controle Diário"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-white">
              <button
                type="button"
                onClick={() => setMonthKey((k) => shiftMonthKey(k, -1))}
                className="inline-flex h-11 w-11 items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-32 flex-1 text-center text-sm font-semibold">
                {monthLabel(monthKey)}
              </span>
              <button
                type="button"
                onClick={() => setMonthKey((k) => shiftMonthKey(k, 1))}
                className="inline-flex h-11 w-11 items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setHabitsOpen(true)}
            >
              <Pencil className="h-4 w-4" /> Gerenciar hábitos
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        {loading || !data ? (
          <p className="py-10 text-center text-[var(--muted)]">Carregando...</p>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <KpiCard
                icon={Percent}
                label="Média de Conclusão"
                value={`${data.metrics.avgCompletion.toFixed(1)}%`}
                color="#7b68ee"
              />
              <KpiCard
                icon={Flame}
                label="Dias perfeitos"
                value={String(data.metrics.perfectDays)}
                color="#22c55e"
              />
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
              <h3 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
                Evolução da pontuação diária
              </h3>
              <EvolutionChart days={data.days} habits={activeHabits} />
            </div>

            <HabitsSection
              days={data.days}
              habits={activeHabits}
              onToggle={toggleCheck}
            />

            <ConsistencyHeatmap days={data.days} />
          </>
        )}
      </div>

      <HabitsManagerModal
        open={habitsOpen}
        onClose={() => setHabitsOpen(false)}
        habits={data?.habits ?? []}
        onChanged={() => load(monthKey)}
      />
    </div>
  );
}

/* ---------------- KPI ---------------- */

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted)]">{label}</p>
          <p className="truncate text-xl font-bold text-[var(--foreground)]">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Hábitos (tabela desktop + cards mobile) ---------------- */

function HabitsSection({
  days,
  habits,
  onToggle,
}: {
  days: DayRow[];
  habits: Habit[];
  onToggle: (day: DayRow, habitId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Hábitos recorrentes
        </h3>
        <p className="text-xs text-[var(--muted)]">
          Marque o que concluiu — a pontuação do dia atualiza na hora.
        </p>
      </div>

      {/* Cards mobile */}
      <div className="space-y-3 p-3 md:hidden">
        {days.map((d) => (
          <DayHabitCard
            key={d.id}
            day={d}
            habits={habits}
            onToggle={onToggle}
          />
        ))}
      </div>

      {/* Tabela desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <th className="sticky left-0 z-10 bg-[var(--surface)] px-3 py-2.5 font-medium">
                Dia
              </th>
              {habits.map((h) => (
                <th
                  key={h.id}
                  className="max-w-[5.5rem] px-2 py-2.5 text-center font-medium"
                  title={h.name}
                >
                  <span className="line-clamp-2 leading-tight">{h.name}</span>
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-medium">Nota</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr
                key={d.id}
                className={`border-b border-[var(--border)] last:border-0 ${
                  d.isFuture ? "opacity-45" : "hover:bg-black/[0.02]"
                }`}
              >
                <td className="sticky left-0 z-10 whitespace-nowrap bg-[var(--surface)] px-3 py-2">
                  {(() => {
                    const parts = dayLabelParts(d.date);
                    return (
                      <div className="leading-tight">
                        <span className="text-sm font-semibold text-[var(--foreground)]">
                          {parts?.dayMonth ?? String(d.day).padStart(2, "0")}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-medium text-[var(--muted)]">
                          {parts?.weekday}
                        </span>
                      </div>
                    );
                  })()}
                </td>
                {habits.map((h) => (
                  <td key={h.id} className="px-2 py-2 text-center">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={Boolean(d.checks[h.id])}
                        disabled={d.isFuture}
                        onChange={() => onToggle(d, h.id)}
                      />
                    </div>
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  {d.score === null ? (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  ) : (
                    <ScorePill score={d.score} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayHabitCard({
  day: d,
  habits,
  onToggle,
}: {
  day: DayRow;
  habits: Habit[];
  onToggle: (day: DayRow, habitId: string) => void;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 ${
        d.isFuture ? "opacity-50" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {formatDayLabel(d.date)}
          </p>
        </div>
        {d.score === null ? (
          <span className="shrink-0 text-xs text-[var(--muted)]">Futuro</span>
        ) : (
          <ScorePill score={d.score} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {habits.map((h) => {
          const on = Boolean(d.checks[h.id]);
          return (
            <button
              key={h.id}
              type="button"
              disabled={d.isFuture}
              onClick={() => onToggle(d, h.id)}
              className={`flex min-h-11 items-center gap-2 rounded-lg border px-2.5 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                on
                  ? "border-green-500/40 bg-green-500/10 text-green-700"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                  on
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-slate-300"
                }`}
              >
                {on && <Check className="h-2.5 w-2.5" />}
              </span>
              <span className="line-clamp-2">{h.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const color =
    score > 80 ? "#22c55e" : score >= 50 ? "#facc15" : "#ef4444";
  return (
    <span
      className="inline-flex min-w-12 justify-center rounded-full px-2 py-0.5 text-xs font-bold"
      style={{
        backgroundColor: color,
        color: score >= 50 && score <= 80 ? "#78350f" : "#fff",
      }}
    >
      {score.toFixed(0)}%
    </span>
  );
}

function Checkbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition-all disabled:cursor-not-allowed ${
        checked
          ? "border-green-500 bg-green-500 text-white"
          : "border-slate-300 hover:border-[var(--brand)]"
      }`}
    >
      {checked && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ---------------- Gráfico de evolução (barras) ---------------- */

function EvolutionChart({
  days,
  habits,
}: {
  days: DayRow[];
  habits: Habit[];
}) {
  return (
    <div className="-mx-1 overflow-x-auto scroll-x-fade px-1">
      <div className="flex h-44 min-w-[480px] items-end gap-[3px] sm:min-w-0">
        {days.map((d) => {
          const score = d.score ?? 0;
          const filled =
            !d.isFuture &&
            habits.some((h) => d.checks[h.id]);
          const color = d.isFuture
            ? "#e2e8f0"
            : !filled
              ? "#e2e8f0"
              : score >= 100
                ? "#22c55e"
                : score >= 70
                  ? "#0ea5e9"
                  : score >= 40
                    ? "#f59e0b"
                    : "#ef4444";
          return (
            <div
              key={d.id}
              className="group relative flex flex-1 flex-col items-center"
              title={
                d.isFuture
                  ? `Dia ${d.day}: futuro`
                  : `Dia ${d.day}: ${score.toFixed(0)}%`
              }
            >
              <div className="flex h-36 w-full items-end">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${Math.max(d.isFuture ? 4 : filled ? score : 4, 4)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <span className="mt-1 text-[9px] text-[var(--muted)]">{d.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Heatmap ---------------- */

function ConsistencyHeatmap({ days }: { days: DayRow[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <CalendarDays className="h-4 w-4" />
            Calendário de consistência
          </h3>
          <p className="text-xs text-[var(--muted)]">
            Cor pela pontuação dos hábitos do dia.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
          <Legend color="#22c55e" label="> 80%" />
          <Legend color="#facc15" label="50–80%" />
          <Legend color="#ef4444" label="< 50%" />
          <Legend color="#e2e8f0" label="Futuro / vazio" />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((w, i) => (
          <div
            key={`${w}-${i}`}
            className="pb-1 text-center text-[10px] font-medium text-[var(--muted)]"
          >
            {w}
          </div>
        ))}
        {/* Offset do 1º dia da semana (0=domingo) */}
        {(() => {
          if (days.length === 0) return null;
          const first = new Date(days[0].date + "T12:00:00");
          const offset = first.getDay();
          const pads = Array.from({ length: offset }, (_, i) => (
            <div key={`pad-${i}`} />
          ));
          return (
            <>
              {pads}
              {days.map((d) => {
                const bg = heatmapColor(d.score, d.isFuture);
                const darkText = bg === "#facc15" || bg === "#e2e8f0";
                return (
                  <div
                    key={d.id}
                    title={
                      d.isFuture
                        ? `Dia ${d.day}: futuro`
                        : `Dia ${d.day}: ${d.score?.toFixed(0) ?? 0}%`
                    }
                    className="flex aspect-square items-center justify-center rounded-lg text-xs font-bold transition-transform hover:scale-105"
                    style={{
                      backgroundColor: bg,
                      color: darkText ? "#334155" : "#fff",
                    }}
                  >
                    {d.day}
                  </div>
                );
              })}
            </>
          );
        })()}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

/* ---------------- Gerenciar hábitos ---------------- */

function HabitsManagerModal({
  open,
  onClose,
  habits,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  habits: Habit[];
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await apiPost("/api/daily/habits", { name: newName.trim() });
      setNewName("");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function rename(id: string, name: string) {
    await apiPatch(`/api/daily/habits/${id}`, { name });
    onChanged();
  }

  async function toggleActive(h: Habit) {
    await apiPatch(`/api/daily/habits/${h.id}`, { active: !h.active });
    onChanged();
  }

  async function remove(h: Habit) {
    if (!confirm(`Excluir o hábito "${h.name}"? Os registros dele serão apagados.`))
      return;
    await apiDelete(`/api/daily/habits/${h.id}`);
    onChanged();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerenciar hábitos recorrentes"
      size="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--muted)]">
          Adicione, renomeie, desative ou exclua hábitos. Só os ativos entram na
          pontuação do dia.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Novo hábito..."
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} disabled={saving || !newName.trim()} className="sm:w-auto">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {habits.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              Nenhum hábito cadastrado.
            </p>
          ) : (
            habits.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                onRename={rename}
                onToggle={() => toggleActive(h)}
                onRemove={() => remove(h)}
              />
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

function HabitRow({
  habit,
  onRename,
  onToggle,
  onRemove,
}: {
  habit: Habit;
  onRename: (id: string, name: string) => Promise<void>;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(habit.name);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setName(habit.name);
    setDirty(false);
  }, [habit.name]);

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3 sm:flex-row sm:items-center ${
        habit.active ? "" : "opacity-60"
      }`}
    >
      <input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setDirty(true);
        }}
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--brand)]"
      />
      <div className="flex flex-wrap items-center gap-2">
        {dirty && (
          <button
            type="button"
            onClick={async () => {
              await onRename(habit.id, name.trim() || habit.name);
              setDirty(false);
            }}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[var(--brand)] px-3 text-xs font-medium text-white"
          >
            <Check className="h-3.5 w-3.5" /> Salvar
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--muted)] hover:bg-black/[0.03]"
        >
          {habit.active ? "Desativar" : "Ativar"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
          aria-label="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
