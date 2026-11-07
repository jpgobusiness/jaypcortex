"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import {
  Trophy,
  Star,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Settings,
  Plus,
  Trash2,
  GripVertical,
  X,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import { Button, Input, Label, FormRow } from "@/components/ui/form";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/fetcher";
import {
  currentMonthKey,
  shiftMonthKey,
  monthLabel,
  formatDayLabel,
  dayLabelParts,
  heatmapColor,
} from "@/lib/daily";

/* ============ Types ============ */

type ChallengeItem = {
  id: string;
  name: string;
  icon: string;
  order: number;
  active: boolean;
};

type ChallengeDay = {
  id: string;
  day: number;
  date: string;
  checks: string[]; // array of itemIds that are checked
};

const DEFAULT_GOAL_SCORE = 70;

/* ============ Helpers ============ */

function calcScore(d: ChallengeDay, activeItems: ChallengeItem[]): number {
  const total = activeItems.length;
  if (total === 0) return 0;
  const points = d.checks.filter((id) => activeItems.some((item) => item.id === id)).length;
  return (points / total) * 100;
}

function dayHasData(d: ChallengeDay): boolean {
  return d.checks.length > 0;
}

function isFutureDay(date: string): boolean {
  return date.slice(0, 10) > new Date().toISOString().slice(0, 10);
}

function evolutionBarColor(score: number, goalScore: number): string {
  if (score >= 100) return "#22c55e";
  if (score >= goalScore) return "#86efac";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function scoreColor(score: number, goalScore: number): string {
  if (score >= 100) return "#22c55e";
  if (score >= goalScore) return "#0ea5e9";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

/** Resolve um nome de ícone lucide para o componente React. */
function getLucideIcon(name: string): React.ComponentType<{ className?: string }> {
  // Converte kebab-case para PascalCase: "cup-soda" → "CupSoda"
  const pascal = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const icons = LucideIcons as Record<string, unknown>;
  const Icon = icons[pascal] as React.ComponentType<{ className?: string }> | undefined;
  return Icon ?? LucideIcons.Circle;
}

/* ============ Main Page ============ */

export default function DesafioPage() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [days, setDays] = useState<ChallengeDay[]>([]);
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [goalScore, setGoalScore] = useState(DEFAULT_GOAL_SCORE);
  const [goalInput, setGoalInput] = useState(String(DEFAULT_GOAL_SCORE));
  const [loading, setLoading] = useState(true);
  const [itemModalOpen, setItemModalOpen] = useState(false);

  const activeItems = useMemo(() => items.filter((i) => i.active), [items]);

  const load = useCallback(async (key: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiGet<{
        monthKey: string;
        goalScore: number;
        items: ChallengeItem[];
        days: ChallengeDay[];
      }>(`/api/challenge/month/${key}`);
      setDays(res.days);
      setItems(res.items);
      setGoalScore(res.goalScore ?? DEFAULT_GOAL_SCORE);
      setGoalInput(String(res.goalScore ?? DEFAULT_GOAL_SCORE));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(monthKey);
  }, [monthKey, load]);

  async function toggleItem(dayNum: number, itemId: string) {
    // Optimistic update
    setDays((prev) =>
      prev.map((d) => {
        if (d.day !== dayNum) return d;
        const has = d.checks.includes(itemId);
        return {
          ...d,
          checks: has ? d.checks.filter((id) => id !== itemId) : [...d.checks, itemId],
        };
      })
    );
    try {
      await apiPatch(`/api/challenge/month/${monthKey}/${dayNum}`, { toggleItem: itemId });
    } catch {
      await load(monthKey, true);
    }
  }

  async function saveGoalScore() {
    const parsed = Math.min(100, Math.max(0, Number(goalInput) || DEFAULT_GOAL_SCORE));
    setGoalInput(String(parsed));
    setGoalScore(parsed);
    try {
      await apiPatch(`/api/challenge/month/${monthKey}`, { goalScore: parsed });
    } catch {
      await load(monthKey, true);
    }
  }

  const filledDays = useMemo(() => days.filter((d) => d.checks.length > 0), [days]);

  const avgScore = useMemo(() => {
    if (filledDays.length === 0) return 0;
    return filledDays.reduce((s, d) => s + calcScore(d, activeItems), 0) / filledDays.length;
  }, [filledDays, activeItems]);

  const perfectDays = useMemo(
    () => days.filter((d) => calcScore(d, activeItems) === 100).length,
    [days, activeItems]
  );

  const monthNav = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setItemModalOpen(true)}
        className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium text-[var(--foreground)] hover:bg-black/[0.02]"
        title="Configurar itens do desafio"
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">Itens</span>
      </button>
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
    </div>
  );

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Desafio"
          actions={monthNav}
        />
        <p className="p-6 text-[var(--muted)]">Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Desafio"
        actions={monthNav}
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <ScoreCard
            icon={Trophy}
            label="Adesão do mês"
            value={`${avgScore.toFixed(1)}%`}
            color="#7b68ee"
          />
          <ScoreCard
            icon={Star}
            label="Dias Perfeitos"
            value={String(perfectDays)}
            color="#22c55e"
          />
          <ScoreCard
            icon={CalendarDays}
            label="Dias Preenchidos"
            value={`${filledDays.length} / ${days.length}`}
            color="#0ea5e9"
          />
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Evolução da pontuação diária
            </h3>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              Meta do mês
              <input
                type="number"
                min={0}
                max={100}
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onBlur={saveGoalScore}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-14 rounded border border-[var(--border)] bg-white px-1.5 py-1 text-center text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              />
              %
            </label>
          </div>
          <EvolutionChart days={days} activeItems={activeItems} goalScore={goalScore} />
        </div>

        {/* Heatmap de consistência */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
              <CalendarDays className="h-4 w-4" />
              Calendário de consistência
            </h3>
            <p className="text-xs text-[var(--muted)]">Cor pela pontuação dos hábitos do dia.</p>
          </div>
          <ConsistencyHeatmap days={days} activeItems={activeItems} />
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
            <LegendDot color="#22c55e" label="> 80%" />
            <LegendDot color="#facc15" label="50–80%" />
            <LegendDot color="#ef4444" label="< 50%" />
            <LegendDot color="#e2e8f0" label="Futuro / vazio" />
          </div>
        </div>

        {/* Registro diário */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Registro diário — {monthLabel(monthKey)}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Marque seus hábitos e a pontuação é calculada em tempo real.
            </p>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 p-3 md:hidden">
            {days.map((d) => (
              <DayCard
                key={d.id}
                day={d}
                items={activeItems}
                goalScore={goalScore}
                onToggle={toggleItem}
              />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
                  <th className="sticky left-0 z-10 bg-[var(--surface)] px-3 py-2.5 font-medium">
                    Dia
                  </th>
                  {activeItems.map((item) => {
                    const Icon = getLucideIcon(item.icon);
                    return (
                      <th key={item.id} className="px-3 py-2.5 text-center font-medium" title={item.name}>
                        <div className="flex flex-col items-center gap-0.5">
                          <Icon className="h-3.5 w-3.5" />
                          <span className="text-[9px] normal-case tracking-normal">{item.name.length > 6 ? item.name.slice(0, 6) + "…" : item.name}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-3 py-2.5 text-center font-medium">
                    <div className="flex flex-col items-center gap-0.5 normal-case tracking-normal">
                      <span>Meta</span>
                      <div className="flex items-center gap-0.5 font-normal">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={goalInput}
                          onChange={(e) => setGoalInput(e.target.value)}
                          onBlur={saveGoalScore}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className="w-10 rounded border border-[var(--border)] bg-white px-1 py-0.5 text-center text-[10px] font-semibold text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                          aria-label="Meta de nota do mês"
                        />
                        <span className="text-[10px]">%</span>
                      </div>
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium">Nota</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <DayRow
                    key={d.id}
                    day={d}
                    items={activeItems}
                    goalScore={goalScore}
                    onToggle={toggleItem}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de configuração de itens */}
      <ItemsConfigModal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        items={items}
        onChanged={() => load(monthKey, true)}
      />
    </div>
  );
}

/* ============ Items Config Modal ============ */

function ItemsConfigModal({
  open,
  onClose,
  items,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  items: ChallengeItem[];
  onChanged: () => void;
}) {
  const [localItems, setLocalItems] = useState<ChallengeItem[]>(items);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("circle");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setLocalItems(items);
  }, [open, items]);

  async function addItem() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await apiPost("/api/challenge/items", { name: newName.trim(), icon: newIcon || "circle" });
      setNewName("");
      setNewIcon("circle");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    setLocalItems((prev) => prev.filter((i) => i.id !== id));
    await apiDelete(`/api/challenge/items/${id}`);
    onChanged();
  }

  async function toggleActive(item: ChallengeItem) {
    const next = !item.active;
    setLocalItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: next } : i)));
    await apiPatch(`/api/challenge/items/${item.id}`, { active: next });
    onChanged();
  }

  async function updateItem(id: string, data: Partial<ChallengeItem>) {
    setLocalItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)));
    await apiPatch(`/api/challenge/items/${id}`, data);
    onChanged();
  }

  return (
    <Modal open={open} onClose={onClose} title="Configurar Itens do Desafio" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-[var(--muted)]">
          Adicione, remova ou edite os itens que aparecem no controle diário. Itens inativos não contam na pontuação.
        </p>

        {/* Lista de itens existentes */}
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {localItems.map((item) => {
            const Icon = getLucideIcon(item.icon);
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                  item.active
                    ? "border-[var(--border)] bg-white"
                    : "border-dashed border-slate-300 bg-slate-50 opacity-60"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(item.id, { name: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--foreground)] outline-none"
                />
                <input
                  type="text"
                  value={item.icon}
                  onChange={(e) => updateItem(item.id, { icon: e.target.value })}
                  className="w-24 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted)] outline-none focus:border-[var(--brand)]"
                  placeholder="ícone"
                  title="Nome do ícone lucide (kebab-case)"
                />
                <button
                  type="button"
                  onClick={() => toggleActive(item)}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    item.active
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-200 text-slate-500"
                  }`}
                  title={item.active ? "Ativo — clique para desativar" : "Inativo — clique para ativar"}
                >
                  {item.active ? "Ativo" : "Inativo"}
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="rounded-md p-1.5 text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
                  title="Remover item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Adicionar novo */}
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2.5">
          <Plus className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do novo item"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem();
            }}
          />
          <input
            type="text"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            placeholder="ícone"
            className="w-24 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted)] outline-none focus:border-[var(--brand)]"
            title="Nome do ícone lucide (kebab-case). Ex: droplets, dumbbell, coffee"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!newName.trim() || saving}
            className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>

        <p className="text-[11px] text-[var(--muted)]">
          Ícones: use nomes do Lucide em kebab-case (ex: droplets, dumbbell, coffee, apple, utensils, beer-off).
        </p>
      </div>
    </Modal>
  );
}

/* ============ DayCard (mobile) ============ */

function DayCard({
  day: d,
  items,
  goalScore,
  onToggle,
}: {
  day: ChallengeDay;
  items: ChallengeItem[];
  goalScore: number;
  onToggle: (day: number, itemId: string) => void;
}) {
  const dayScore = calcScore(d, items);
  const scoreBg = scoreColor(dayScore, goalScore);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {formatDayLabel(d.date)}
          </p>
        </div>
        <span
          className="inline-flex min-w-12 shrink-0 justify-center rounded-full px-2.5 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: scoreBg }}
        >
          {dayScore.toFixed(0)}%
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const on = d.checks.includes(item.id);
          const Icon = getLucideIcon(item.icon);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(d.day, item.id)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors ${
                on
                  ? "border-green-500/40 bg-green-500/10 text-green-700"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                  on ? "border-green-500 bg-green-500 text-white" : "border-slate-300"
                }`}
              >
                {on && (
                  <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              {item.name.length > 8 ? item.name.slice(0, 8) + "…" : item.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============ DayRow (desktop table) ============ */

function DayRow({
  day: d,
  items,
  goalScore,
  onToggle,
}: {
  day: ChallengeDay;
  items: ChallengeItem[];
  goalScore: number;
  onToggle: (day: number, itemId: string) => void;
}) {
  const dayScore = calcScore(d, items);
  const scoreBg = scoreColor(dayScore, goalScore);
  const future = isFutureDay(d.date);
  const hasData = dayHasData(d);
  const metGoal = hasData && !future && dayScore >= goalScore;
  const missedGoal = hasData && !future && dayScore < goalScore;

  return (
    <tr className="border-b border-[var(--border)] last:border-0 hover:bg-black/[0.02]">
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
      {items.map((item) => (
        <td key={item.id} className="px-3 py-2">
          <div className="flex justify-center">
            <Checkbox
              checked={d.checks.includes(item.id)}
              onChange={() => onToggle(d.day, item.id)}
            />
          </div>
        </td>
      ))}
      <td className="px-3 py-2 text-center">
        {metGoal ? (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500/15 text-xs font-bold text-green-600">
            ✓
          </span>
        ) : missedGoal ? (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-xs font-bold text-red-600">
            ✗
          </span>
        ) : (
          <span className="text-xs text-[var(--muted)]">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <span
          className="inline-flex min-w-12 justify-center rounded-full px-2 py-0.5 text-xs font-bold text-white"
          style={{ backgroundColor: scoreBg }}
        >
          {dayScore.toFixed(0)}%
        </span>
      </td>
    </tr>
  );
}

/* ============ Checkbox ============ */

function Checkbox({
  checked,
  onChange,
  color = "#22c55e",
}: {
  checked: boolean;
  onChange: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange();
      }}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
        checked ? "text-white" : "border-slate-300 hover:border-[var(--brand)]"
      }`}
      style={checked ? { backgroundColor: color, borderColor: color } : {}}
    >
      {checked && (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

/* ============ ScoreCard ============ */

function ScoreCard({
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
        <div>
          <p className="text-xs text-[var(--muted)]">{label}</p>
          <p className="text-xl font-bold text-[var(--foreground)]">{value}</p>
        </div>
      </div>
    </div>
  );
}

/* ============ Evolution Chart ============ */

function EvolutionChart({
  days,
  activeItems,
  goalScore,
}: {
  days: ChallengeDay[];
  activeItems: ChallengeItem[];
  goalScore: number;
}) {
  const yTicks = [100, 75, 50, 25, 0];

  return (
    <div className="flex gap-2">
      <div className="flex h-36 shrink-0 flex-col justify-between text-[10px] font-medium leading-none text-[var(--muted)]">
        {yTicks.map((tick) => (
          <span key={tick}>{tick}%</span>
        ))}
      </div>
      <div className="-mx-1 flex-1 overflow-x-auto scroll-x-fade px-1">
        <div className="min-w-[480px] sm:min-w-0">
          <div className="relative h-36">
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-violet-500"
              style={{ bottom: `${goalScore}%` }}
            />
            <span
              className="pointer-events-none absolute right-0 z-20 rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600"
              style={{ bottom: `${goalScore}%`, transform: "translateY(50%)" }}
            >
              Meta {goalScore}%
            </span>
            <div className="flex h-full items-end gap-[3px]">
              {days.map((d) => {
                const dayScore = calcScore(d, activeItems);
                const filled = dayHasData(d);
                const barColor = !filled ? "#e2e8f0" : evolutionBarColor(dayScore, goalScore);
                return (
                  <div key={d.day} className="relative h-full flex-1" title={`Dia ${d.day}: ${dayScore.toFixed(0)}%`}>
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-t-sm transition-all"
                      style={{
                        height: filled ? `${dayScore}%` : "0%",
                        minHeight: filled && dayScore > 0 ? 2 : 0,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-1 flex gap-[3px]">
            {days.map((d) => (
              <span key={d.day} className="flex-1 text-center text-[9px] text-[var(--muted)]">
                {d.day}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Consistency Heatmap ============ */

function ConsistencyHeatmap({
  days,
  activeItems,
}: {
  days: ChallengeDay[];
  activeItems: ChallengeItem[];
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {["D", "S", "T", "Q", "Q", "S", "S"].map((w, i) => (
        <div key={`${w}-${i}`} className="pb-1 text-center text-[10px] font-medium text-[var(--muted)]">
          {w}
        </div>
      ))}
      {(() => {
        if (days.length === 0) return null;
        const first = new Date(days[0].date + "T12:00:00");
        const offset = first.getDay();
        const pads = Array.from({ length: offset }, (_, i) => <div key={`pad-${i}`} />);
        return (
          <>
            {pads}
            {days.map((d) => {
              const dateStr = d.date?.slice(0, 10) ?? "";
              const isFuture = dateStr > today;
              const filled = dayHasData(d);
              const score = !isFuture && filled ? calcScore(d, activeItems) : null;
              const bg = isFuture || !filled ? "#e2e8f0" : heatmapColor(score, false);
              const textColor = bg === "#facc15" || bg === "#e2e8f0" ? "#334155" : "#fff";
              return (
                <div
                  key={d.id}
                  title={
                    isFuture
                      ? `Dia ${d.day}: futuro`
                      : !filled
                        ? `Dia ${d.day}: vazio`
                        : `Dia ${d.day}: ${score?.toFixed(0) ?? 0}%`
                  }
                  className="flex aspect-square items-center justify-center rounded-lg text-xs font-bold transition-transform hover:scale-105"
                  style={{ backgroundColor: bg, color: textColor }}
                >
                  {d.day}
                </div>
              );
            })}
          </>
        );
      })()}
    </div>
  );
}

/* ============ Legend ============ */

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
