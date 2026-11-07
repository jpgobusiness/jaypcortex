"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Target,
  Pencil,
  Trash2,
  Download,
  Paperclip,
  Check,
  X,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Button, Input } from "@/components/ui/form";
import OvertimeEntryModal from "@/components/overtime/OvertimeEntryModal";
import { apiGet, apiPatch, apiDelete } from "@/lib/fetcher";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  currentMonthKey,
  monthLabel,
  monthShortLabel,
  shiftMonth,
} from "@/lib/monthkey";
import type {
  OvertimeEntry,
  OvertimeMonthDetail,
  OvertimeMonthSummary,
} from "@/lib/types";

export default function HorasExtrasPage() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [detail, setDetail] = useState<OvertimeMonthDetail | null>(null);
  const [months, setMonths] = useState<OvertimeMonthSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OvertimeEntry | null>(null);

  // Edição de valor-hora e meta do mês
  const [rateInput, setRateInput] = useState("");
  const [goalInput, setGoalInput] = useState("");

  const loadMonths = useCallback(async () => {
    setMonths(await apiGet<OvertimeMonthSummary[]>("/api/overtime/months"));
  }, []);

  const loadDetail = useCallback(async (key: string) => {
    const d = await apiGet<OvertimeMonthDetail>(`/api/overtime/months/${key}`);
    setDetail(d);
    setRateInput(d.hourlyRate ? String(d.hourlyRate) : "");
    setGoalInput(d.goalHours ? String(d.goalHours) : "");
  }, []);

  const reload = useCallback(async () => {
    await Promise.all([loadDetail(monthKey), loadMonths()]);
  }, [loadDetail, loadMonths, monthKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([loadDetail(monthKey), loadMonths()]).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [monthKey, loadDetail, loadMonths]);

  const rateDirty = detail && rateInput !== (detail.hourlyRate ? String(detail.hourlyRate) : "");
  const goalDirty = detail && goalInput !== (detail.goalHours ? String(detail.goalHours) : "");
  const configDirty = Boolean(rateDirty || goalDirty);

  async function saveConfig() {
    await apiPatch(`/api/overtime/months/${monthKey}`, {
      hourlyRate: Number(rateInput || 0),
      goalHours: Number(goalInput || 0),
    });
    await reload();
  }

  async function removeEntry(e: OvertimeEntry) {
    if (!confirm("Excluir este registro de hora extra?")) return;
    await apiDelete(`/api/overtime/entries/${e.id}`);
    await reload();
  }

  async function removeAttachment(attachmentId: string) {
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        entries: prev.entries.map((entry) => ({
          ...entry,
          attachments: entry.attachments.filter((a) => a.id !== attachmentId),
        })),
      };
    });
    await apiDelete(`/api/overtime/attachments/${attachmentId}`);
  }

  async function toggleClickup(e: OvertimeEntry) {
    const next = !e.clickupRequested;
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        entries: prev.entries.map((x) =>
          x.id === e.id ? { ...x, clickupRequested: next } : x
        ),
      };
    });
    try {
      await apiPatch(`/api/overtime/entries/${e.id}`, {
        clickupRequested: next,
      });
    } catch {
      await reload();
    }
  }

  const goalProgress =
    detail && detail.goalHours > 0
      ? (detail.totalHours / detail.goalHours) * 100
      : 0;

  const maxHours = useMemo(
    () => Math.max(1, ...months.map((m) => m.totalHours)),
    [months]
  );
  const maxValue = useMemo(
    () => Math.max(1, ...months.map((m) => m.totalValue)),
    [months]
  );

  return (
    <div>
      <PageHeader
        title="Horas Extras"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-white">
              <button
                onClick={() => setMonthKey((k) => shiftMonth(k, -1))}
                className="inline-flex h-11 w-11 items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-28 flex-1 text-center text-sm font-semibold">
                {monthLabel(monthKey)}
              </span>
              <button
                onClick={() => setMonthKey((k) => shiftMonth(k, 1))}
                className="inline-flex h-11 w-11 items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Nova hora extra
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        {loading || !detail ? (
          <p className="py-10 text-center text-[var(--muted)]">Carregando...</p>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={Clock}
                label="Horas no mês"
                value={`${detail.totalHours.toLocaleString("pt-BR")} h`}
                color="#7b68ee"
              />
              <KpiCard
                icon={Coins}
                label="Valor total"
                value={formatCurrency(detail.totalValue)}
                color="#22c55e"
              />
              <KpiCard
                icon={Target}
                label="Meta de horas"
                value={
                  detail.goalHours > 0
                    ? `${detail.totalHours} / ${detail.goalHours} h`
                    : "Sem meta"
                }
                color="#f59e0b"
              />
              <KpiCard
                icon={Paperclip}
                label="Registros"
                value={String(detail.entries.length)}
                color="#0ea5e9"
              />
            </div>

            {/* Config do mês + meta */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 lg:col-span-1">
                <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                  Configuração do mês
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                      Valor da hora (R$)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rateInput}
                      onChange={(e) => setRateInput(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                      Meta de horas
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  {configDirty && (
                    <Button onClick={saveConfig} className="w-full">
                      <Check className="h-4 w-4" /> Salvar
                    </Button>
                  )}
                </div>
              </div>

              {/* Progresso da meta */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 lg:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    Progresso da meta
                  </h3>
                  <span className="text-sm font-medium text-[var(--brand-600)]">
                    {detail.goalHours > 0
                      ? `${goalProgress.toFixed(0)}%`
                      : "—"}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full rounded-full bg-[var(--brand)] transition-all"
                    style={{ width: `${Math.min(goalProgress, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {detail.totalHours} h de{" "}
                  {detail.goalHours > 0 ? `${detail.goalHours} h` : "meta não definida"}
                  {detail.goalHours > 0 &&
                    detail.totalHours < detail.goalHours &&
                    ` · faltam ${(detail.goalHours - detail.totalHours).toLocaleString(
                      "pt-BR"
                    )} h`}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4 text-sm">
                  <div>
                    <p className="text-xs text-[var(--muted)]">Valor da hora</p>
                    <p className="font-semibold">
                      {formatCurrency(detail.hourlyRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">
                      Valor total do mês
                    </p>
                    <p className="font-semibold">
                      {formatCurrency(detail.totalValue)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparativo entre meses */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <MonthChart
                title="Horas por mês"
                months={months}
                currentKey={monthKey}
                max={maxHours}
                valueOf={(m) => m.totalHours}
                format={(v) => `${v.toLocaleString("pt-BR")}h`}
                onPick={setMonthKey}
              />
              <MonthChart
                title="Valor por mês"
                months={months}
                currentKey={monthKey}
                max={maxValue}
                valueOf={(m) => m.totalValue}
                format={(v) => formatCurrency(v, true)}
                onPick={setMonthKey}
              />
            </div>

            {/* Registros do mês */}
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  Registros de {monthLabel(monthKey)}
                </h3>
              </div>

              {/* Cards mobile */}
              <div className="divide-y divide-[var(--border)] md:hidden">
                {detail.entries.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                    Nenhuma hora extra registrada neste mês.
                  </p>
                ) : (
                  detail.entries.map((e) => (
                    <div key={e.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--foreground)]">
                            {formatDate(e.date)}
                          </p>
                          <p className="mt-0.5 text-sm text-[var(--muted)]">
                            {e.hours.toLocaleString("pt-BR")} h ·{" "}
                            <span className="font-semibold text-[var(--foreground)]">
                              {formatCurrency(e.hours * detail.hourlyRate)}
                            </span>
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => toggleClickup(e)}
                            title={
                              e.clickupRequested
                                ? "Validado e solicitado no ClickUp"
                                : "Marcar como solicitado no ClickUp"
                            }
                            className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all ${
                              e.clickupRequested
                                ? "border-green-500 bg-green-500 text-white"
                                : "border-slate-300 text-[var(--muted)] hover:border-[var(--brand)]"
                            }`}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditing(e);
                              setModalOpen(true);
                            }}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.05]"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeEntry(e)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {e.description && (
                        <p className="text-sm text-[var(--muted)]">{e.description}</p>
                      )}
                      {e.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {e.attachments.map((a) => (
                            <span
                              key={a.id}
                              className="inline-flex max-w-full items-center gap-1 rounded-md bg-black/[0.05] px-2 py-1.5 text-[11px] text-[var(--foreground)]"
                            >
                              <a
                                href={`/api/overtime/attachments/${a.id}?download=1`}
                                className="inline-flex items-center gap-1 truncate"
                              >
                                <Download className="h-3 w-3 shrink-0" />
                                <span className="truncate">{a.name}</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => removeAttachment(a.id)}
                                className="ml-0.5 shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-red-100 hover:text-red-600"
                                title={`Remover ${a.name}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Tabela desktop */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-4 py-3 font-medium">Data</th>
                      <th className="px-4 py-3 text-right font-medium">Horas</th>
                      <th className="px-4 py-3 text-right font-medium">Valor</th>
                      <th className="px-4 py-3 font-medium">Descrição</th>
                      <th className="px-4 py-3 font-medium">Anexos</th>
                      <th className="sticky right-[5.5rem] z-10 bg-[var(--surface)] px-3 py-3 text-center font-medium shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                        ClickUp
                      </th>
                      <th className="sticky right-0 z-10 bg-[var(--surface)] px-4 py-3 text-right font-medium shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.entries.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-[var(--muted)]"
                        >
                          Nenhuma hora extra registrada neste mês.
                        </td>
                      </tr>
                    ) : (
                      detail.entries.map((e) => (
                        <tr
                          key={e.id}
                          className="border-b border-[var(--border)] last:border-0 hover:bg-black/[0.02]"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-[var(--foreground)]">
                            {formatDate(e.date)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                            {e.hours.toLocaleString("pt-BR")} h
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                            {formatCurrency(e.hours * detail.hourlyRate)}
                          </td>
                          <td className="max-w-[12rem] px-4 py-3 text-[var(--muted)] lg:max-w-xs">
                            <span className="line-clamp-2">
                              {e.description || "—"}
                            </span>
                          </td>
                          <td className="max-w-[9rem] px-4 py-3">
                            {e.attachments.length === 0 ? (
                              <span className="text-[var(--muted)]">—</span>
                            ) : (
                              <div className="flex max-w-[9rem] flex-col gap-1">
                                {e.attachments.map((a) => (
                                  <span
                                    key={a.id}
                                    className="inline-flex max-w-full items-center gap-1 rounded-md bg-black/[0.05] px-2 py-1 text-[11px] text-[var(--foreground)]"
                                  >
                                    <a
                                      href={`/api/overtime/attachments/${a.id}?download=1`}
                                      className="inline-flex items-center gap-1 truncate hover:bg-black/[0.03]"
                                      title={`Baixar ${a.name}`}
                                    >
                                      <Download className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{a.name}</span>
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => removeAttachment(a.id)}
                                      className="ml-0.5 shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-red-100 hover:text-red-600"
                                      title={`Remover ${a.name}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="sticky right-[5.5rem] z-10 bg-[var(--surface)] px-3 py-3 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={() => toggleClickup(e)}
                                title={
                                  e.clickupRequested
                                    ? "Validado e solicitado no ClickUp"
                                    : "Marcar como solicitado no ClickUp"
                                }
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                                  e.clickupRequested
                                    ? "border-green-500 bg-green-500 text-white"
                                    : "border-slate-300 hover:border-[var(--brand)]"
                                }`}
                              >
                                {e.clickupRequested && (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="sticky right-0 z-10 bg-[var(--surface)] px-4 py-3 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditing(e);
                                  setModalOpen(true);
                                }}
                                className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-black/[0.05] hover:text-[var(--foreground)]"
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => removeEntry(e)}
                                className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <OvertimeEntryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={reload}
        monthKey={monthKey}
        entry={editing}
      />
    </div>
  );
}

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
          <p className="truncate text-lg font-bold text-[var(--foreground)]">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function MonthChart({
  title,
  months,
  currentKey,
  max,
  valueOf,
  format,
  onPick,
}: {
  title: string;
  months: OvertimeMonthSummary[];
  currentKey: string;
  max: number;
  valueOf: (m: OvertimeMonthSummary) => number;
  format: (v: number) => string;
  onPick: (key: string) => void;
}) {
  const data = months.filter((m) => m.entryCount > 0 || m.monthKey === currentKey);
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
        {title}
      </h3>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted)]">
          Sem dados ainda.
        </p>
      ) : (
        <div className="flex h-44 items-end gap-2 overflow-x-auto scroll-x-fade pb-1">
          {data.map((m) => {
            const v = valueOf(m);
            const active = m.monthKey === currentKey;
            return (
              <button
                key={m.monthKey}
                onClick={() => onPick(m.monthKey)}
                className="flex min-w-12 flex-1 flex-col items-center gap-1"
                title={`${monthLabel(m.monthKey)}: ${format(v)}`}
              >
                <span className="text-[10px] font-medium text-[var(--muted)]">
                  {format(v)}
                </span>
                <div className="flex h-28 w-full items-end">
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{
                      height: `${Math.max((v / max) * 100, 2)}%`,
                      backgroundColor: active ? "var(--brand)" : "#cbd5e1",
                    }}
                  />
                </div>
                <span
                  className={`text-[10px] ${
                    active
                      ? "font-semibold text-[var(--brand-600)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {monthShortLabel(m.monthKey)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
