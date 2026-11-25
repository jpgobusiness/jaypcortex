"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarClock, CreditCard, Landmark } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IconBubble } from "@/components/finance/icons";
import { InvoicePill, Progress } from "@/components/finance/ui";
import {
  breakdown,
  inRange,
  KPI_LABELS,
  kpiValue,
  monthlyFlow,
  periodRange,
  previousRange,
  sankeyData,
  stackedByMonth,
  topFacts,
  type Lookup,
} from "@/lib/finance/analytics";
import { diffDays, formatYmd, monthRange, shortMonth, type MonthKey, type Ymd } from "@/lib/finance/dates";
import { formatBRL, formatBRLCompact } from "@/lib/finance/money";
import type { AgendaItem, FinAnalytics, FinCard, WidgetConfig } from "@/lib/finance/types";

export type WidgetContext = {
  analytics: FinAnalytics;
  lookup: Lookup;
  range: { from: MonthKey; to: MonthKey };
  includeProjected: boolean;
  today: Ymd;
  cards: FinCard[];
  onPay?: (item: AgendaItem) => void;
};

export const SIZE_CLASSES: Record<WidgetConfig["size"], string> = {
  sm: "col-span-12 sm:col-span-6 xl:col-span-3",
  md: "col-span-12 xl:col-span-6",
  lg: "col-span-12 xl:col-span-9",
  full: "col-span-12",
};

const INCOME = "#16a34a";
const EXPENSE = "#f43f5e";
const BRAND = "#7b68ee";

export function widgetTitle(widget: WidgetConfig): string {
  if (widget.title) return widget.title;
  if (widget.type === "kpi") return KPI_LABELS[widget.metric ?? "net"];
  const titles: Record<WidgetConfig["type"], string> = {
    kpi: "Indicador",
    cashflow: "Receitas × despesas",
    balance: "Saldo no tempo",
    breakdown: widget.kind === "income" ? "Receitas por categoria" : "Despesas por categoria",
    stacked: "Mês a mês",
    sankey: "Fluxo do dinheiro",
    top: widget.kind === "income" ? "Maiores receitas" : "Maiores despesas",
    agenda: "Próximos vencimentos",
    cards: "Cartões",
    loans: "Empréstimos",
  };
  return titles[widget.type];
}

export function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: Record<string, unknown> }[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label !== undefined && <p className="mb-1 font-semibold text-slate-700">{typeof label === "string" && /^\d{4}-\d{2}$/.test(label) ? shortMonth(label) : label}</p>}
      {payload.map((item, index) => (
        <p key={index} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color ?? (item.payload?.color as string) ?? BRAND }} />
          <span>{item.name}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums text-slate-800">{formatBRL(Number(item.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

const axis = { fontSize: 11, fill: "#94a3b8" };
const Empty = ({ text = "Sem dados no período" }: { text?: string }) => (
  <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">{text}</div>
);

function Kpi({ widget, ctx, range }: { widget: WidgetConfig; ctx: WidgetContext; range: { from: MonthKey; to: MonthKey } }) {
  const metric = widget.metric ?? "net";
  const previous = previousRange(range.from, range.to);
  const result = kpiValue(metric, {
    facts: inRange(ctx.analytics.facts, range.from, range.to, ctx.includeProjected),
    previous: inRange(ctx.analytics.facts, previous.from, previous.to, ctx.includeProjected),
    from: range.from,
    to: range.to,
    analytics: ctx.analytics,
    lookup: ctx.lookup,
  });
  const value =
    result.value === null
      ? "—"
      : result.format === "money"
        ? formatBRL(result.value)
        : result.format === "percent"
          ? `${result.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
          : `${result.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses`;
  const negative = result.value !== null && result.value < 0;
  const good = result.delta !== null && (result.delta >= 0) === result.upIsGood;
  return (
    <div>
      <p className={`text-2xl font-semibold tabular-nums tracking-tight ${negative ? "text-rose-600" : "text-[var(--foreground)]"}`}>{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {result.delta !== null && Number.isFinite(result.delta) && (
          <span
            title="Comparado com o período anterior"
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
          >
            {result.delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(result.delta).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            {result.format === "percent" ? " p.p." : "%"}
          </span>
        )}
        <p className="truncate text-xs text-[var(--muted)]">{result.hint}</p>
      </div>
    </div>
  );
}

function Cashflow({ ctx, range, height = 240 }: { ctx: WidgetContext; range: { from: MonthKey; to: MonthKey }; height?: number }) {
  const months = monthRange(range.from, range.to);
  const data = monthlyFlow(inRange(ctx.analytics.facts, range.from, range.to, ctx.includeProjected), months).map((row) => ({
    ...row,
    future: row.month > ctx.today.slice(0, 7),
  }));
  if (data.every((row) => row.income === 0 && row.expense === 0)) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke="#eef0f3" />
        <XAxis dataKey="month" tickFormatter={shortMonth} tick={axis} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(value: number) => formatBRLCompact(value)} tick={axis} axisLine={false} tickLine={false} width={72} />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(123,104,238,0.06)" }} />
        <Bar dataKey="income" name="Receitas" fill={INCOME} radius={[6, 6, 0, 0]} maxBarSize={28}>
          {data.map((row) => (
            <Cell key={row.month} fillOpacity={row.future ? 0.45 : 1} />
          ))}
        </Bar>
        <Bar dataKey="expense" name="Despesas" fill={EXPENSE} radius={[6, 6, 0, 0]} maxBarSize={28}>
          {data.map((row) => (
            <Cell key={row.month} fillOpacity={row.future ? 0.45 : 1} />
          ))}
        </Bar>
        <Line dataKey="net" name="Resultado" stroke={BRAND} strokeWidth={2.5} dot={{ r: 3, fill: BRAND }} type="monotone" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function BalanceChart({ ctx, range }: { ctx: WidgetContext; range: { from: MonthKey; to: MonthKey } }) {
  const points = ctx.analytics.balance.filter((point) => point.month >= range.from && point.month <= range.to);
  if (points.length === 0) return <Empty />;
  const lastReal = [...points].reverse().find((point) => !point.projected);
  const data = points.map((point) => ({
    month: point.month,
    realized: point.projected ? undefined : point.balanceCents,
    projected: point.projected || point === lastReal ? point.balanceCents : undefined,
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="fin-balance" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#eef0f3" />
        <XAxis dataKey="month" tickFormatter={shortMonth} tick={axis} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(value: number) => formatBRLCompact(value)} tick={axis} axisLine={false} tickLine={false} width={72} />
        <Tooltip content={<MoneyTooltip />} />
        <Area dataKey="realized" name="Saldo no fim do mês" stroke={BRAND} strokeWidth={2.5} fill="url(#fin-balance)" type="monotone" connectNulls />
        <Line dataKey="projected" name="Previsto" stroke={BRAND} strokeWidth={2.5} strokeDasharray="6 5" dot={{ r: 3, fill: "#fff", stroke: BRAND }} type="monotone" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function Breakdown({ widget, ctx, range }: { widget: WidgetConfig; ctx: WidgetContext; range: { from: MonthKey; to: MonthKey } }) {
  const kind = widget.kind ?? "expense";
  const dimension = widget.dimension ?? "group";
  const facts = inRange(ctx.analytics.facts, range.from, range.to, ctx.includeProjected).filter((fact) => fact.kind === kind);
  const slices = breakdown(facts, dimension, ctx.lookup, widget.limit ?? 8);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return <Empty />;

  if (widget.chart === "bars" || dimension === "weekday") {
    const max = Math.max(...slices.map((slice) => slice.value));
    return (
      <ul className="space-y-2.5">
        {slices.map((slice) => (
          <li key={slice.key}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="truncate text-slate-700">{slice.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-800">
                {formatBRL(slice.value)} <span className="text-xs text-[var(--muted)]">{((slice.value / total) * 100).toFixed(0)}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.05]">
              <div className="h-full rounded-full" style={{ width: `${max ? (slice.value / max) * 100 : 0}%`, backgroundColor: slice.color }} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius="64%" outerRadius="100%" paddingAngle={2} stroke="none">
              {slices.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<MoneyTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-[var(--muted)]">Total</span>
          <span className="text-sm font-semibold tabular-nums">{formatBRLCompact(total)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
            <span className="min-w-0 flex-1 truncate text-slate-700">{slice.label}</span>
            <span className="tabular-nums text-slate-800">{formatBRL(slice.value)}</span>
            <span className="w-9 text-right text-xs tabular-nums text-[var(--muted)]">{((slice.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stacked({ widget, ctx, range }: { widget: WidgetConfig; ctx: WidgetContext; range: { from: MonthKey; to: MonthKey } }) {
  const kind = widget.kind ?? "expense";
  const months = monthRange(range.from, range.to);
  const facts = inRange(ctx.analytics.facts, range.from, range.to, ctx.includeProjected).filter((fact) => fact.kind === kind);
  const { series, rows } = stackedByMonth(facts, months, widget.dimension ?? "group", ctx.lookup, widget.limit ?? 6);
  if (series.length === 0) return <Empty />;
  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis dataKey="month" tickFormatter={shortMonth} tick={axis} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(value: number) => formatBRLCompact(value)} tick={axis} axisLine={false} tickLine={false} width={72} />
          <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(123,104,238,0.06)" }} />
          {series.map((slice, index) => (
            <Bar key={slice.key} dataKey={slice.key} name={slice.label} stackId="a" fill={slice.color} maxBarSize={36} radius={index === series.length - 1 ? [6, 6, 0, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((slice) => (
          <span key={slice.key} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} />
            {slice.label}
          </span>
        ))}
      </div>
    </div>
  );
}

type NodeProps = { x: number; y: number; width: number; height: number; payload: { name: string; color: string; value: number; depth: number } };

const shorten = (text: string, max = 22) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

function SankeyNode({ x, y, width, height, payload }: NodeProps) {
  const rect = <rect x={x} y={y} width={width} height={Math.max(height, 2)} rx={3} fill={payload.color} />;
  // Nó do meio: rótulo em cima, para não cobrir os fluxos.
  if (payload.depth === 1) {
    return (
      <g>
        {rect}
        <text x={x + width / 2} y={y - 8} textAnchor="middle" fontSize={12} fontWeight={600} fill="#334155">
          {payload.name}
          <tspan fill="#94a3b8" fontWeight={400} dx={6}>
            {formatBRLCompact(payload.value)}
          </tspan>
        </text>
      </g>
    );
  }
  const left = payload.depth === 0;
  return (
    <g>
      {rect}
      <text x={left ? x - 8 : x + width + 8} y={y + height / 2} textAnchor={left ? "end" : "start"} dominantBaseline="middle" fontSize={12} fill="#334155">
        <title>{payload.name}</title>
        {shorten(payload.name)}
        <tspan fill="#94a3b8" dx={6}>
          {formatBRLCompact(payload.value)}
        </tspan>
      </text>
    </g>
  );
}

function SankeyFlow({ ctx, range }: { ctx: WidgetContext; range: { from: MonthKey; to: MonthKey } }) {
  const data = sankeyData(inRange(ctx.analytics.facts, range.from, range.to, ctx.includeProjected), ctx.lookup);
  if (data.links.length === 0) return <Empty />;
  const height = Math.max(260, data.nodes.length * 34);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <ResponsiveContainer width="100%" height={height}>
          <Sankey
            data={data}
            nodePadding={14}
            nodeWidth={12}
            iterations={64}
            margin={{ top: 28, right: 230, bottom: 8, left: 190 }}
            link={{ stroke: BRAND, strokeOpacity: 0.16 }}
            node={(props: unknown) => <SankeyNode {...(props as NodeProps)} />}
          >
            <Tooltip content={<MoneyTooltip />} />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Top({ widget, ctx, range }: { widget: WidgetConfig; ctx: WidgetContext; range: { from: MonthKey; to: MonthKey } }) {
  const kind = widget.kind ?? "expense";
  const facts = topFacts(inRange(ctx.analytics.facts, range.from, range.to, ctx.includeProjected).filter((fact) => fact.kind === kind), widget.limit ?? 8);
  if (facts.length === 0) return <Empty />;
  return (
    <ul className="divide-y divide-[var(--border)]">
      {facts.map((fact) => {
        const category = fact.categoryId ? ctx.lookup.categories.get(fact.categoryId) : undefined;
        const where = fact.cardId ? ctx.lookup.cards.get(fact.cardId)?.name : fact.accountId ? ctx.lookup.accounts.get(fact.accountId)?.name : "";
        return (
          <li key={fact.id} className="flex items-center gap-3 py-2">
            <IconBubble icon={category?.icon ?? "tag"} color={category?.color ?? "#94a3b8"} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-800">{fact.description}</p>
              <p className="truncate text-xs text-[var(--muted)]">
                {formatYmd(fact.date, false)} · {category?.name ?? "Sem categoria"}
                {where ? ` · ${where}` : ""}
              </p>
            </div>
            <span className={`text-sm font-medium tabular-nums ${kind === "income" ? "text-emerald-600" : "text-slate-800"}`}>{formatBRL(fact.amountCents)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function AgendaList({ items, today, onPay, limit = 8 }: { items: AgendaItem[]; today: Ymd; onPay?: (item: AgendaItem) => void; limit?: number }) {
  const list = items.filter((item) => item.overdue || diffDays(today, item.date) <= 45).slice(0, limit);
  if (list.length === 0) return <Empty text="Nada vencendo nos próximos 45 dias" />;
  return (
    <ul className="divide-y divide-[var(--border)]">
      {list.map((item) => {
        const days = diffDays(today, item.date);
        const when = item.overdue ? `Atrasado ${Math.abs(days)}d` : days === 0 ? "Hoje" : days === 1 ? "Amanhã" : `Em ${days} dias`;
        return (
          <li key={`${item.source}-${item.id}`} className="flex items-center gap-3 py-2.5">
            <span className={`flex w-12 shrink-0 flex-col items-center rounded-xl py-1 ${item.overdue ? "bg-rose-50 text-rose-700" : "bg-black/[0.04] text-slate-700"}`}>
              <span className="text-sm font-semibold leading-none">{item.date.slice(8, 10)}</span>
              <span className="text-[10px] uppercase">{shortMonth(item.date.slice(0, 7)).slice(0, 3)}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm text-slate-800">
                {item.source === "invoice" && <CreditCard className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />}
                <span className="truncate">{item.description}</span>
              </p>
              <p className={`text-xs ${item.overdue ? "text-rose-600" : "text-[var(--muted)]"}`}>{when}</p>
            </div>
            <span className={`text-sm font-medium tabular-nums ${item.kind === "income" ? "text-emerald-600" : "text-slate-800"}`}>
              {item.kind === "income" ? "+ " : ""}
              {formatBRL(item.amountCents)}
            </span>
            {onPay &&
              (item.source === "invoice" ? (
                <Link href={`/financas/cartoes/${item.cardId}?fatura=${item.invoiceMonth}`} className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--brand-600)] hover:bg-[var(--brand)]/10">
                  Ver
                </Link>
              ) : (
                <button type="button" onClick={() => onPay(item)} className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--brand-600)] hover:bg-[var(--brand)]/10">
                  {item.kind === "income" ? "Receber" : "Pagar"}
                </button>
              ))}
          </li>
        );
      })}
    </ul>
  );
}

function Cards({ ctx }: { ctx: WidgetContext }) {
  const cards = ctx.cards.filter((card) => !card.archived);
  if (cards.length === 0) return <Empty text="Nenhum cartão cadastrado" />;
  return (
    <ul className="space-y-4">
      {cards.map((card) => {
        const invoice = card.dueInvoice ?? card.openInvoice;
        return (
          <li key={card.id}>
            <Link href={`/financas/cartoes/${card.id}`} className="group block">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-6 w-9 shrink-0 rounded-md" style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}aa)` }} />
                  <span className="truncate text-sm font-medium text-slate-800 group-hover:text-[var(--brand-600)]">{card.name}</span>
                </span>
                <span className="flex items-center gap-2 text-sm tabular-nums text-slate-800">
                  {formatBRL(invoice.totalCents)}
                  <InvoicePill status={invoice.status} />
                </span>
              </div>
              <div className="mt-2">
                <Progress value={card.usedCents} max={card.limitCents} color={card.color === "#15171c" ? BRAND : card.color} />
              </div>
              <p className="mt-1 flex justify-between text-xs text-[var(--muted)]">
                <span>
                  {formatBRL(card.availableCents)} livres de {formatBRL(card.limitCents)}
                </span>
                <span>Vence {formatYmd(invoice.dueDate, false)}</span>
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Loans({ ctx }: { ctx: WidgetContext }) {
  const loans = ctx.analytics.loans;
  if (loans.length === 0) return <Empty text="Nenhum empréstimo cadastrado" />;
  return (
    <ul className="space-y-4">
      {loans.map((loan) => (
        <li key={loan.id}>
          <Link href={`/financas/emprestimos/${loan.id}`} className="group block">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Landmark className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                <span className="truncate font-medium text-slate-800 group-hover:text-[var(--brand-600)]">{loan.name}</span>
              </span>
              <span className="tabular-nums text-slate-800">{formatBRL(loan.balanceCents)}</span>
            </div>
            <div className="mt-2">
              <Progress value={loan.paidCount} max={loan.installmentCount} warnAt={2} color={INCOME} />
            </div>
            <p className="mt-1 flex justify-between text-xs text-[var(--muted)]">
              <span>
                {loan.paidCount}/{loan.installmentCount} pagas · {loan.monthlyRate.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.m.
              </span>
              {loan.nextDue && (
                <span className="flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" /> {formatYmd(loan.nextDue.date, false)}
                </span>
              )}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Uma visão (widget). `range` força o período; senão usa o do widget ou o do dashboard. */
export function WidgetBody({ widget, ctx, range, height }: { widget: WidgetConfig; ctx: WidgetContext; range?: { from: MonthKey; to: MonthKey }; height?: number }) {
  const period = range ?? (widget.period ? periodRange(widget.period, ctx.today) : ctx.range);
  switch (widget.type) {
    case "kpi":
      return <Kpi widget={widget} ctx={ctx} range={period} />;
    case "cashflow":
      return <Cashflow ctx={ctx} range={period} height={height} />;
    case "balance":
      return <BalanceChart ctx={ctx} range={period} />;
    case "breakdown":
      return <Breakdown widget={widget} ctx={ctx} range={period} />;
    case "stacked":
      return <Stacked widget={widget} ctx={ctx} range={period} />;
    case "sankey":
      return <SankeyFlow ctx={ctx} range={period} />;
    case "top":
      return <Top widget={widget} ctx={ctx} range={period} />;
    case "agenda":
      return <AgendaList items={ctx.analytics.agenda} today={ctx.today} onPay={ctx.onPay} limit={widget.limit ?? 8} />;
    case "cards":
      return <Cards ctx={ctx} />;
    case "loans":
      return <Loans ctx={ctx} />;
  }
}

/** Intervalo de meses que cobre todos os widgets (para buscar uma vez só). */
export function coveringRange(widgets: WidgetConfig[], base: { from: MonthKey; to: MonthKey }, today: Ymd) {
  let { from, to } = base;
  for (const widget of widgets) {
    const own = widget.period ? periodRange(widget.period, today) : base;
    // KPIs comparam com o período anterior.
    const start = widget.type === "kpi" ? previousRange(own.from, own.to).from : own.from;
    if (start < from) from = start;
    if (own.to > to) to = own.to;
  }
  return { from, to };
}
