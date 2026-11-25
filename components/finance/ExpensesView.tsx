"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  CheckCircle2,
  ListX,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CategorySelect } from "@/components/finance/EntryModal";
import { useFinance } from "@/components/finance/FinanceProvider";
import { EmptyState, ErrorNote, MonthSwitcher, Panel, Stat, useApi } from "@/components/finance/ui";
import { MoneyTooltip } from "@/components/finance/widgets";
import { Button, Input, Select } from "@/components/ui/form";
import { apiDelete, apiPatch } from "@/lib/fetcher";
import { EXPENSE_NATURE_LABELS, type Nature } from "@/lib/finance/constants";
import { addMonthsToKey, diffDays, formatYmd, isMonthKey, longMonth, monthOf, shortMonth, type MonthKey, type Ymd } from "@/lib/finance/dates";
import { chartWindow, type ChartPreset } from "@/lib/finance/expenses";
import { formatBRL, formatBRLCompact } from "@/lib/finance/money";
import type { ExpenseStatus, FinExpense, FinExpenses } from "@/lib/finance/types";

type StatusFilter = "" | "pay" | "overdue" | "paid";
type EssentialFilter = "" | "yes" | "no";
type SortKey = "description" | "category" | "origin" | "due" | "amount" | "paid";
type SortDir = "asc" | "desc";

const PAID = "#16a34a";
const PENDING = "#f59e0b";
const OVERDUE = "#f43f5e";
const axis = { fontSize: 11, fill: "#94a3b8" };
const sum = (list: FinExpense[]) => list.reduce((total, item) => total + item.amountCents, 0);
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const PAID_ORDER: Record<ExpenseStatus, number> = { overdue: 0, unpaid: 1, paid: 2 };

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "pay", label: "Não pagas" },
  { value: "overdue", label: "Atrasadas" },
  { value: "paid", label: "Pagas" },
];

const CHART_PRESETS: { value: ChartPreset; label: string }[] = [
  { value: "past12", label: "12 anteriores" },
  { value: "next12", label: "12 à frente" },
  { value: "m24", label: "24 meses" },
  { value: "custom", label: "Personalizado" },
];

const PAID_FLAG: Record<ExpenseStatus, { label: string; idle: string; mark: string }> = {
  paid: {
    label: "Pago",
    idle: "bg-emerald-100 text-emerald-800",
    mark: "border-emerald-600 bg-emerald-600 text-white",
  },
  unpaid: {
    label: "Não pago",
    idle: "bg-amber-100 text-amber-800",
    mark: "border-amber-500 bg-white",
  },
  overdue: {
    label: "Atrasado",
    idle: "bg-rose-100 text-rose-800",
    mark: "border-rose-500 bg-white",
  },
};

function parseStatus(value: string | null): StatusFilter {
  return value === "pay" || value === "overdue" || value === "paid" ? value : "";
}
function parseEssential(value: string | null): EssentialFilter {
  return value === "1" ? "yes" : value === "0" ? "no" : "";
}
function parseNature(value: string | null): Nature | "" {
  return value && value in EXPENSE_NATURE_LABELS ? (value as Nature) : "";
}
function parseSort(value: string | null): SortKey {
  return value === "description" || value === "category" || value === "origin" || value === "amount" || value === "paid" ? value : "due";
}
function parseChart(value: string | null): ChartPreset {
  return value === "past12" || value === "next12" || value === "m24" || value === "custom" ? value : "m24";
}

function matchesStatus(item: FinExpense, filter: StatusFilter) {
  if (!filter) return true;
  if (filter === "pay") return item.status === "unpaid";
  return item.status === filter;
}

function dueHint(dueDate: Ymd, today: Ymd, paid: boolean) {
  if (paid) return null;
  const days = diffDays(today, dueDate);
  if (days < 0) return `venceu há ${plural(-days, "dia", "dias")}`;
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  return `em ${days} dias`;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-[var(--foreground)] text-white" : "bg-black/[0.04] text-slate-600 hover:bg-black/[0.07]"
      }`}
    >
      {children}
    </button>
  );
}

function SortHeader({
  label,
  column,
  sort,
  dir,
  align = "left",
  onSort,
}: {
  label: string;
  column: SortKey;
  sort: SortKey;
  dir: SortDir;
  align?: "left" | "right";
  onSort: (column: SortKey) => void;
}) {
  const active = sort === column;
  const Icon = dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""} ${active ? "text-[var(--foreground)]" : "hover:text-[var(--foreground)]"}`}
      >
        {label}
        {active && <Icon className="h-3 w-3" />}
      </button>
    </th>
  );
}

function MonthsChart({ months, selected, onPick }: { months: FinExpenses["months"]; selected: MonthKey; onPick: (month: MonthKey) => void }) {
  const data = months.map((row) => ({
    month: row.month,
    paid: row.paidCents,
    pending: row.pendingCents,
    overdue: row.overdueCents,
  }));
  if (data.every((row) => row.paid === 0 && row.pending === 0 && row.overdue === 0)) {
    return <p className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">Sem despesas neste período.</p>;
  }
  const opacity = (month: MonthKey) => (month === selected ? 1 : 0.4);
  const dense = data.length <= 16;
  const barSize = data.length <= 6 ? 56 : data.length <= 12 ? 40 : 28;
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
        className="cursor-pointer"
        onClick={(state) => {
          const label = state.activeLabel;
          const month = typeof label === "string" && isMonthKey(label) ? label : data[Number(state.activeTooltipIndex)]?.month;
          if (month) onPick(month);
        }}
      >
        <CartesianGrid vertical={false} stroke="#eef0f3" />
        <XAxis dataKey="month" tickFormatter={shortMonth} tick={axis} axisLine={false} tickLine={false} interval={dense ? 0 : "preserveStartEnd"} />
        <YAxis tickFormatter={(value: number) => formatBRLCompact(value)} tick={axis} axisLine={false} tickLine={false} width={72} />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(123,104,238,0.06)" }} />
        <Bar dataKey="paid" name="Paga" stackId="month" fill={PAID} maxBarSize={barSize}>
          {data.map((row) => (
            <Cell key={`p-${row.month}`} fillOpacity={opacity(row.month)} />
          ))}
        </Bar>
        <Bar dataKey="pending" name="Não pago" stackId="month" fill={PENDING} maxBarSize={barSize}>
          {data.map((row) => (
            <Cell key={`n-${row.month}`} fillOpacity={opacity(row.month)} />
          ))}
        </Bar>
        <Bar dataKey="overdue" name="Atrasada" stackId="month" fill={OVERDUE} maxBarSize={barSize} radius={[6, 6, 0, 0]}>
          {data.map((row) => (
            <Cell key={`o-${row.month}`} fillOpacity={opacity(row.month)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function ExpensesView() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { today, accounts, cards, categories, ready, version, refresh, openEntry, category, account, card, editTransaction } = useFinance();
  const current = monthOf(today);
  const [month, setMonthState] = useState<MonthKey>(isMonthKey(params.get("mes")) ? params.get("mes")! : current);
  const [status, setStatusState] = useState<StatusFilter>(parseStatus(params.get("status")));
  const [nature, setNatureState] = useState<Nature | "">(parseNature(params.get("tipo")));
  const [categoryId, setCategoryState] = useState(params.get("categoria") ?? "");
  const [source, setSourceState] = useState(params.get("origem") ?? "");
  const [essential, setEssentialState] = useState<EssentialFilter>(parseEssential(params.get("essencial")));
  const [q, setQState] = useState(params.get("q") ?? "");
  const [sort, setSortState] = useState<SortKey>(parseSort(params.get("ordem")));
  const [dir, setDirState] = useState<SortDir>(params.get("dir") === "desc" ? "desc" : "asc");
  const [chart, setChartState] = useState<ChartPreset>(parseChart(params.get("grafico")));
  const [chartFrom, setChartFromState] = useState(isMonthKey(params.get("de")) ? params.get("de")! : addMonthsToKey(current, -11));
  const [chartTo, setChartToState] = useState(isMonthKey(params.get("ate")) ? params.get("ate")! : current);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlMonth = isMonthKey(params.get("mes")) ? params.get("mes")! : current;
  const span = chartWindow(today, chart, { from: chartFrom, to: chartTo });

  useEffect(() => {
    setMonthState(urlMonth);
  }, [urlMonth]);

  const { data, error: loadError, loading } = useApi<FinExpenses>(
    ready ? `/api/financas/expenses?month=${month}&from=${span.from}&to=${span.to}` : null,
    version
  );

  function persist(next: {
    month: MonthKey;
    status: StatusFilter;
    nature: Nature | "";
    categoryId: string;
    source: string;
    essential: EssentialFilter;
    q: string;
    sort: SortKey;
    dir: SortDir;
    chart: ChartPreset;
    chartFrom: MonthKey;
    chartTo: MonthKey;
  }) {
    const qs = new URLSearchParams();
    if (next.month !== current) qs.set("mes", next.month);
    if (next.status) qs.set("status", next.status);
    if (next.nature) qs.set("tipo", next.nature);
    if (next.categoryId) qs.set("categoria", next.categoryId);
    if (next.source) qs.set("origem", next.source);
    if (next.essential === "yes") qs.set("essencial", "1");
    if (next.essential === "no") qs.set("essencial", "0");
    if (next.sort !== "due") qs.set("ordem", next.sort);
    if (next.dir !== "asc") qs.set("dir", next.dir);
    if (next.chart !== "m24") qs.set("grafico", next.chart);
    if (next.chart === "custom") {
      qs.set("de", next.chartFrom);
      qs.set("ate", next.chartTo);
    }
    const term = next.q.trim();
    if (term) qs.set("q", term.slice(0, 80));
    const query = qs.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }

  const query = { month, status, nature, categoryId, source, essential, q, sort, dir, chart, chartFrom, chartTo };
  function patch(partial: Partial<typeof query>) {
    const next = { ...query, ...partial };
    setMonthState(next.month);
    setStatusState(next.status);
    setNatureState(next.nature);
    setCategoryState(next.categoryId);
    setSourceState(next.source);
    setEssentialState(next.essential);
    setQState(next.q);
    setSortState(next.sort);
    setDirState(next.dir);
    setChartState(next.chart);
    setChartFromState(next.chartFrom);
    setChartToState(next.chartTo);
    persist(next);
  }

  function originOf(item: FinExpense) {
    const foundCard = card(item.cardId);
    if (foundCard) {
      return {
        key: `card:${foundCard.id}`,
        name: foundCard.name,
        kind: "Cartão",
        extra: item.invoiceMonth ? `fatura ${shortMonth(item.invoiceMonth)}` : null,
        color: foundCard.color,
      };
    }
    const foundAccount = account(item.accountId);
    if (item.loanId) {
      return {
        key: foundAccount ? `account:${foundAccount.id}` : "loan",
        name: foundAccount?.name ?? "Empréstimo",
        kind: "Empréstimo",
        extra: null,
        color: foundAccount?.color ?? "#ef4444",
      };
    }
    if (foundAccount) {
      return { key: `account:${foundAccount.id}`, name: foundAccount.name, kind: "Conta", extra: null, color: foundAccount.color };
    }
    return { key: "none", name: "—", kind: "", extra: null, color: "#94a3b8" };
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = (data?.items ?? []).filter((item) => {
      if (!matchesStatus(item, status)) return false;
      if (nature && item.nature !== nature) return false;
      if (essential === "yes" && !item.essential) return false;
      if (essential === "no" && item.essential) return false;
      if (source.startsWith("account:") && item.accountId !== source.slice(8)) return false;
      if (source.startsWith("card:") && item.cardId !== source.slice(5)) return false;
      if (source === "loan" && !item.loanId) return false;
      if (categoryId) {
        const selected = categories.find((entry) => entry.id === categoryId);
        const childIds = categories.filter((entry) => entry.parentId === categoryId).map((entry) => entry.id);
        if (item.categoryId !== categoryId && !(selected && childIds.includes(item.categoryId ?? ""))) return false;
      }
      if (term) {
        const origin = originOf(item);
        const hay = `${item.description} ${item.detail} ${origin.name} ${item.tags.join(" ")} ${item.notes}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    const sign = dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sort === "description") cmp = a.description.localeCompare(b.description, "pt-BR");
      else if (sort === "category") cmp = (category(a.categoryId)?.name ?? "").localeCompare(category(b.categoryId)?.name ?? "", "pt-BR");
      else if (sort === "origin") cmp = originOf(a).name.localeCompare(originOf(b).name, "pt-BR");
      else if (sort === "amount") cmp = a.amountCents - b.amountCents;
      else if (sort === "paid") cmp = PAID_ORDER[a.status] - PAID_ORDER[b.status];
      else cmp = a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
      if (cmp === 0) cmp = a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : b.amountCents - a.amountCents;
      return cmp * sign;
    });
  }, [data, status, nature, essential, source, categoryId, q, categories, sort, dir, cards, accounts, category, card, account]);

  const filtering = Boolean(status || nature || categoryId || source || essential || q.trim());

  async function toggleCleared(item: FinExpense) {
    setBusy(item.id);
    setError(null);
    try {
      await apiPatch(`/api/financas/transactions/${item.id}`, {
        clearedAt: item.status === "paid" ? null : today,
      });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar");
    } finally {
      setBusy(null);
    }
  }

  function openItem(item: FinExpense) {
    if (item.loanId) {
      router.push(`/financas/emprestimos/${item.loanId}`);
      return;
    }
    editTransaction(item.transaction);
  }

  async function remove(item: FinExpense) {
    if (item.loanId) {
      if (!confirm(`Excluir o empréstimo “${item.description}” e todas as parcelas?`)) return;
    } else {
      const extra = item.transaction.installmentGroupId
        ? " Só esta parcela. As outras ficam."
        : item.transaction.recurrenceId
          ? " Só este mês. Os próximos ficam."
          : "";
      if (!confirm(`Excluir “${item.description}”?${extra}`)) return;
    }
    setBusy(item.id);
    setError(null);
    try {
      await apiDelete(item.loanId ? `/api/financas/loans/${item.loanId}` : `/api/financas/transactions/${item.id}?scope=one`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir");
    } finally {
      setBusy(null);
    }
  }

  function onSort(column: SortKey) {
    if (sort === column) patch({ dir: dir === "asc" ? "desc" : "asc" });
    else patch({ sort: column, dir: column === "amount" || column === "paid" ? "desc" : "asc" });
  }

  if (!data) {
    return <p className={`py-10 text-center text-sm ${loadError ? "text-rose-600" : "text-[var(--muted)]"}`}>{loadError ?? "Carregando despesas..."}</p>;
  }

  const shown = data.month;
  const stale = loading || shown !== month;
  const { totalCents, paidCents, pendingCents, overdueCents, overdueCount, carriedOverdueCents, carriedOverdueCount, monthOverdueCents } = data.totals;
  const toPay = pendingCents + overdueCents;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MonthSwitcher month={month} onChange={(next) => patch({ month: next })} />
        {month !== current && (
          <Button variant="ghost" onClick={() => patch({ month: current })}>
            Voltar para {shortMonth(current)}
          </Button>
        )}
        <Button variant="outline" onClick={() => openEntry({ flow: "expense" })}>
          <Plus className="h-4 w-4" /> Nova despesa
        </Button>
      </div>

      <ErrorNote message={error ?? loadError} />

      <div className={`space-y-5 transition-opacity ${stale ? "opacity-60" : ""}`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label={`Total em ${shortMonth(shown)}`}
            value={formatBRL(totalCents)}
            tone={totalCents > 0 ? "expense" : "default"}
            icon={<Wallet className="h-3.5 w-3.5" />}
            hint={data.items.length ? plural(data.items.length - carriedOverdueCount, "despesa", "despesas") : "Nenhuma despesa"}
          />
          <button type="button" className="text-left" onClick={() => patch({ status: status === "paid" ? "" : "paid" })}>
            <Stat
              label="Pagas"
              value={formatBRL(paidCents)}
              tone="income"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              hint={totalCents > 0 ? `${Math.round((paidCents / totalCents) * 100)}% do mês` : "Nada pago"}
            />
          </button>
          <button type="button" className="text-left" onClick={() => patch({ status: status === "pay" ? "" : "pay" })}>
            <Stat
              label="Não pagas"
              value={formatBRL(pendingCents)}
              tone={pendingCents > 0 ? "warning" : "default"}
              icon={<CalendarClock className="h-3.5 w-3.5" />}
              hint={pendingCents > 0 ? "Ainda não vencidas" : "Nada em aberto no prazo"}
            />
          </button>
          <button type="button" className="text-left" onClick={() => patch({ status: status === "overdue" ? "" : "overdue" })}>
            <Stat
              label="Atrasadas"
              value={formatBRL(overdueCents)}
              tone={overdueCount > 0 ? "expense" : "default"}
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              hint={
                overdueCount > 0
                  ? carriedOverdueCount > 0
                    ? `${formatBRL(monthOverdueCents)} deste mês · ${formatBRL(carriedOverdueCents)} de antes`
                    : plural(overdueCount, "despesa atrasada", "despesas atrasadas")
                  : "Nada atrasado"
              }
            />
          </button>
        </div>

        <Panel
          title="Despesas por mês"
          subtitle={`Clique num mês para abrir. ${shortMonth(span.from)} — ${shortMonth(span.to)}. Só entra o que vence naquele mês — no cartão, o vencimento da fatura.`}
          action={
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-3 pt-0.5 text-xs text-slate-600">
              <Legend color={PAID} label="Pago" />
              <Legend color={PENDING} label="Não pago" />
              <Legend color={OVERDUE} label="Atrasado" />
            </span>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {CHART_PRESETS.map((item) => (
              <Chip
                key={item.value}
                active={chart === item.value}
                onClick={() =>
                  patch(
                    item.value === "custom"
                      ? { chart: "custom", chartFrom: chartFrom || addMonthsToKey(current, -11), chartTo: chartTo || current }
                      : { chart: item.value }
                  )
                }
              >
                {item.label}
              </Chip>
            ))}
            {chart === "custom" && (
              <span className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  De
                  <Input
                    type="month"
                    value={chartFrom}
                    onChange={(event) => isMonthKey(event.target.value) && patch({ chart: "custom", chartFrom: event.target.value })}
                    className="h-8 min-h-0 w-[9.5rem] py-1 text-xs"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  Até
                  <Input
                    type="month"
                    value={chartTo}
                    onChange={(event) => isMonthKey(event.target.value) && patch({ chart: "custom", chartTo: event.target.value })}
                    className="h-8 min-h-0 w-[9.5rem] py-1 text-xs"
                  />
                </label>
              </span>
            )}
          </div>
          <MonthsChart months={data.months} selected={month} onPick={(next) => patch({ month: next })} />
        </Panel>

        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_CHIPS.map((chip) => (
              <Chip key={chip.value || "all"} active={status === chip.value} onClick={() => patch({ status: chip.value })}>
                {chip.label}
              </Chip>
            ))}
            <Chip active={essential === "yes"} onClick={() => patch({ essential: essential === "yes" ? "" : "yes" })}>
              Essenciais
            </Chip>
            {filtering && (
              <button
                type="button"
                onClick={() => patch({ status: "", nature: "", categoryId: "", source: "", essential: "", q: "" })}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <X className="h-3.5 w-3.5" /> Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input value={q} onChange={(event) => patch({ q: event.target.value })} placeholder="Buscar descrição, cartão ou nota" className="pl-9" />
            </div>
            <Select value={source} onChange={(event) => patch({ source: event.target.value })}>
              <option value="">Todas as origens</option>
              <optgroup label="Contas">
                {accounts.map((item) => (
                  <option key={item.id} value={`account:${item.id}`}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
              {cards.length > 0 && (
                <optgroup label="Cartões">
                  {cards.map((item) => (
                    <option key={item.id} value={`card:${item.id}`}>
                      {item.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value="loan">Empréstimos</option>
            </Select>
            <CategorySelect kind="expense" value={categoryId} onChange={(id) => patch({ categoryId: id })} categories={categories} emptyLabel="Todas as categorias" />
            <Select value={nature} onChange={(event) => patch({ nature: parseNature(event.target.value) })}>
              <option value="">Todos os tipos</option>
              {(Object.keys(EXPENSE_NATURE_LABELS) as Nature[]).map((key) => (
                <option key={key} value={key}>
                  {EXPENSE_NATURE_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Panel
          title={filtering ? `${plural(filtered.length, "despesa", "despesas")} filtrada${filtered.length === 1 ? "" : "s"}` : `Despesas de ${longMonth(shown)}`}
          subtitle={
            filtering
              ? `${formatBRL(sum(filtered))} · ${plural(data.items.length, "despesa", "despesas")} no mês`
              : toPay > 0
                ? `Falta pagar ${formatBRL(toPay)} na conta`
                : "Pagas, não pagas e atrasadas"
          }
          className="overflow-hidden"
          bodyClass="p-0"
        >
          {filtered.length === 0 ? (
            <div className="px-5 py-4">
              {data.items.length === 0 ? (
                <EmptyState
                  icon={<Receipt className="h-5 w-5" />}
                  title={`Nenhuma despesa em ${longMonth(shown)}`}
                  text="Lance uma despesa pontual, uma conta fixa, uma compra no cartão ou um empréstimo."
                  action={
                    <Button onClick={() => openEntry({ flow: "expense" })}>
                      <Plus className="h-4 w-4" /> Nova despesa
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<ListX className="h-5 w-5" />}
                  title="Nada com esses filtros"
                  text="Limpe os filtros ou mude o mês para ver as despesas."
                  action={
                    <Button variant="outline" onClick={() => patch({ status: "", nature: "", categoryId: "", source: "", essential: "", q: "" })}>
                      Limpar filtros
                    </Button>
                  }
                />
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-[var(--surface)] text-xs text-[var(--muted)]">
                  <tr className="border-b border-[var(--border)]">
                    <SortHeader label="Pago" column="paid" sort={sort} dir={dir} onSort={onSort} />
                    <SortHeader label="Descrição" column="description" sort={sort} dir={dir} onSort={onSort} />
                    <SortHeader label="Origem" column="origin" sort={sort} dir={dir} onSort={onSort} />
                    <th className="hidden px-4 py-3 text-left font-medium lg:table-cell">
                      <button
                        type="button"
                        onClick={() => onSort("category")}
                        className={`inline-flex items-center gap-1 ${sort === "category" ? "text-[var(--foreground)]" : "hover:text-[var(--foreground)]"}`}
                      >
                        Categoria
                        {sort === "category" && (dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                      </button>
                    </th>
                    <SortHeader label="Vencimento" column="due" sort={sort} dir={dir} onSort={onSort} />
                    <SortHeader label="Valor" column="amount" sort={sort} dir={dir} align="right" onSort={onSort} />
                    <th className="px-4 py-3 text-right font-medium">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filtered.map((item) => {
                    const origin = originOf(item);
                    const cat = category(item.categoryId);
                    const paid = PAID_FLAG[item.status];
                    const hint = dueHint(item.dueDate, today, item.status === "paid");
                    const installment = item.installmentNumber && item.installmentCount ? `${item.installmentNumber}/${item.installmentCount}` : null;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => openItem(item)}
                        className="cursor-pointer hover:bg-black/[0.03]"
                      >
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            disabled={busy === item.id}
                            onClick={() => void toggleCleared(item)}
                            aria-pressed={item.status === "paid"}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${paid.idle}`}
                          >
                            <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border ${paid.mark}`}>
                              {item.status === "paid" ? <Check className="h-2.5 w-2.5" /> : null}
                            </span>
                            {busy === item.id ? "..." : paid.label}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block max-w-[280px] truncate font-medium text-slate-800">{item.description}</span>
                          <span className="mt-0.5 block max-w-[280px] truncate text-xs text-[var(--muted)]">
                            {[item.nature !== "one_off" ? EXPENSE_NATURE_LABELS[item.nature] : null, installment ? `Parcela ${installment}` : null, item.carried ? `de ${shortMonth(monthOf(item.date))}` : null]
                              .filter(Boolean)
                              .join(" · ") || "Pontual"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex min-w-[140px] items-start gap-2">
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: origin.color }} />
                            <span>
                              <span className="block truncate font-medium text-slate-800">{origin.name}</span>
                              <span className="block truncate text-xs text-[var(--muted)]">{[origin.kind, origin.extra].filter(Boolean).join(" · ")}</span>
                            </span>
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 lg:table-cell">
                          <span className="block truncate text-slate-700">{cat?.name ?? "—"}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="block tabular-nums text-slate-800">{formatYmd(item.dueDate, false)}</span>
                          <span className={`block text-xs ${item.status === "overdue" ? "text-rose-600" : "text-[var(--muted)]"}`}>
                            {hint}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{formatBRL(item.amountCents)}</td>
                        <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                          <span className="inline-flex items-center justify-end gap-1.5">
                            {item.cardId && item.invoiceMonth && (
                              <Link href={`/financas/cartoes/${item.cardId}?fatura=${item.invoiceMonth}`} className="text-xs font-medium text-[var(--brand-600)] hover:underline">
                                Fatura
                              </Link>
                            )}
                            <button
                              type="button"
                              disabled={busy === item.id}
                              onClick={() => void remove(item)}
                              title={item.loanId ? "Excluir empréstimo" : "Excluir despesa"}
                              aria-label={`Excluir ${item.description}`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--border)] bg-black/[0.015] text-sm">
                    <td />
                    <td className="px-4 py-3 font-medium text-slate-700" colSpan={2}>
                      {plural(filtered.length, "despesa", "despesas")}
                    </td>
                    <td className="hidden lg:table-cell" />
                    <td />
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{formatBRL(sum(filtered))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
