// Contas das visões e dashboards (funções puras sobre FactRow).
import { EXPENSE_NATURE_LABELS, NATURE_COLORS, type Nature } from "./constants";
import { addMonthsToKey, daysInMonth, diffDays, monthOf, monthRange, parseYmd, weekday, type MonthKey, type Ymd } from "./dates";
import type { Dimension, FactRow, FinAnalytics, FinCategory, KpiMetric, PeriodPreset } from "./types";

/** Natureza a partir dos vínculos do lançamento. */
export function natureOf(input: {
  kind: string;
  loanId: string | null;
  installmentGroupId: string | null;
  recurrenceId: string | null;
  recurrenceType: string | null;
}): Nature | null {
  if (input.kind !== "income" && input.kind !== "expense") return null;
  if (input.loanId) return "loan";
  if (input.installmentGroupId) return "installment";
  if (input.recurrenceId) return input.recurrenceType === "variable" ? "variable" : "fixed";
  return "one_off";
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  month: "Este mês",
  last3: "Últimos 3 meses",
  last6: "Últimos 6 meses",
  last12: "Últimos 12 meses",
  year: "Este ano",
  next6: "Próximos 6 meses",
};

export function periodRange(preset: PeriodPreset, today: Ymd): { from: MonthKey; to: MonthKey } {
  const current = monthOf(today);
  switch (preset) {
    case "month":
      return { from: current, to: current };
    case "last3":
      return { from: addMonthsToKey(current, -2), to: current };
    case "last6":
      return { from: addMonthsToKey(current, -5), to: current };
    case "last12":
      return { from: addMonthsToKey(current, -11), to: current };
    case "year":
      return { from: `${current.slice(0, 4)}-01`, to: `${current.slice(0, 4)}-12` };
    case "next6":
      return { from: current, to: addMonthsToKey(current, 5) };
  }
}

/** Período anterior com o mesmo número de meses (para comparar). */
export function previousRange(from: MonthKey, to: MonthKey) {
  const length = monthRange(from, to).length;
  return { from: addMonthsToKey(from, -length), to: addMonthsToKey(from, -1) };
}

export function inRange(facts: FactRow[], from: MonthKey, to: MonthKey, includeProjected = true) {
  return facts.filter((fact) => fact.month >= from && fact.month <= to && (includeProjected || fact.realized));
}

export type Named = { name: string; color: string };
export type Lookup = {
  categories: Map<string, FinCategory>;
  accounts: Map<string, Named>;
  cards: Map<string, Named>;
};

export function makeLookup(categories: FinCategory[], accounts: (Named & { id: string })[], cards: (Named & { id: string })[]): Lookup {
  return {
    categories: new Map(categories.map((category) => [category.id, category])),
    accounts: new Map(accounts.map((account) => [account.id, account])),
    cards: new Map(cards.map((card) => [card.id, card])),
  };
}

export type MonthFlow = {
  month: MonthKey;
  income: number;
  expense: number;
  net: number;
  incomeRealized: number;
  expenseRealized: number;
};

export function monthlyFlow(facts: FactRow[], months: MonthKey[]): MonthFlow[] {
  const map = new Map(months.map((month) => [month, { month, income: 0, expense: 0, net: 0, incomeRealized: 0, expenseRealized: 0 }]));
  for (const fact of facts) {
    const row = map.get(fact.month);
    if (!row) continue;
    if (fact.kind === "income") {
      row.income += fact.amountCents;
      if (fact.realized) row.incomeRealized += fact.amountCents;
    } else {
      row.expense += fact.amountCents;
      if (fact.realized) row.expenseRealized += fact.amountCents;
    }
    row.net = row.income - row.expense;
  }
  return [...map.values()];
}

export function totals(facts: FactRow[]) {
  let income = 0;
  let expense = 0;
  for (const fact of facts) {
    if (fact.kind === "income") income += fact.amountCents;
    else expense += fact.amountCents;
  }
  const net = income - expense;
  return { income, expense, net, savingsRate: income > 0 ? (net / income) * 100 : null };
}

export type Slice = { key: string; label: string; color: string; value: number };

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const OTHER_COLOR = "#cbd5e1";

function groupOf(category: FinCategory | undefined, lookup: Lookup) {
  if (!category) return undefined;
  return category.parentId ? lookup.categories.get(category.parentId) ?? category : category;
}

/** Chaves de um lançamento numa dimensão (tag pode dar mais de uma). */
function keysFor(fact: FactRow, dimension: Dimension, lookup: Lookup): Omit<Slice, "value">[] {
  switch (dimension) {
    case "category":
    case "group": {
      const own = fact.categoryId ? lookup.categories.get(fact.categoryId) : undefined;
      const category = dimension === "group" ? groupOf(own, lookup) : own;
      return [category ? { key: category.id, label: category.name, color: category.color } : { key: "none", label: "Sem categoria", color: OTHER_COLOR }];
    }
    case "nature": {
      if (fact.kind === "income") {
        const recurring = fact.nature === "fixed" || fact.nature === "variable";
        return [recurring ? { key: "recurring", label: "Recorrente", color: NATURE_COLORS.fixed } : { key: "one_off", label: "Pontual", color: NATURE_COLORS.one_off }];
      }
      return [{ key: fact.nature, label: EXPENSE_NATURE_LABELS[fact.nature], color: NATURE_COLORS[fact.nature] }];
    }
    case "payment": {
      if (fact.cardId) {
        const card = lookup.cards.get(fact.cardId);
        return [{ key: `card:${fact.cardId}`, label: card?.name ?? "Cartão", color: card?.color ?? "#15171c" }];
      }
      const account = fact.accountId ? lookup.accounts.get(fact.accountId) : undefined;
      return [{ key: `account:${fact.accountId}`, label: account?.name ?? "Conta", color: account?.color ?? "#7b68ee" }];
    }
    case "card": {
      if (!fact.cardId) return [];
      const card = lookup.cards.get(fact.cardId);
      return [{ key: fact.cardId, label: card?.name ?? "Cartão", color: card?.color ?? "#15171c" }];
    }
    case "tag":
      return fact.tags.length
        ? fact.tags.map((tag) => ({ key: tag, label: `#${tag}`, color: "#7b68ee" }))
        : [{ key: "none", label: "Sem tag", color: OTHER_COLOR }];
    case "weekday": {
      const day = weekday(fact.date);
      return [{ key: String(day), label: WEEKDAYS[day], color: "#7b68ee" }];
    }
  }
}

/** Soma por dimensão, do maior para o menor; o que passar de `limit` vira "Outros". */
export function breakdown(facts: FactRow[], dimension: Dimension, lookup: Lookup, limit = 8): Slice[] {
  const map = new Map<string, Slice>();
  for (const fact of facts) {
    for (const key of keysFor(fact, dimension, lookup)) {
      const slice = map.get(key.key) ?? { ...key, value: 0 };
      slice.value += fact.amountCents;
      map.set(key.key, slice);
    }
  }
  if (dimension === "weekday") {
    return WEEKDAYS.map((label, index) => map.get(String(index)) ?? { key: String(index), label, color: "#7b68ee", value: 0 });
  }
  const sorted = [...map.values()].filter((slice) => slice.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1).reduce((sum, slice) => sum + slice.value, 0);
  return [...head, { key: "others", label: "Outros", color: OTHER_COLOR, value: rest }];
}

/** Por mês, empilhado pelas maiores fatias da dimensão. */
export function stackedByMonth(facts: FactRow[], months: MonthKey[], dimension: Dimension, lookup: Lookup, limit = 6) {
  const series = breakdown(facts, dimension, lookup, limit);
  const keep = new Set(series.map((slice) => slice.key));
  const hasOthers = keep.has("others");
  const rows = months.map((month) => {
    const row: Record<string, number | string> = { month };
    for (const slice of series) row[slice.key] = 0;
    return row;
  });
  const byMonth = new Map(rows.map((row) => [row.month as string, row]));
  for (const fact of facts) {
    const row = byMonth.get(fact.month);
    if (!row) continue;
    for (const key of keysFor(fact, dimension, lookup)) {
      const target = keep.has(key.key) ? key.key : hasOthers ? "others" : null;
      if (target) row[target] = (row[target] as number) + fact.amountCents;
    }
  }
  return { series, rows };
}

export type SankeyData = {
  nodes: { name: string; color: string }[];
  links: { source: number; target: number; value: number }[];
};

/** Fluxo do dinheiro: receitas por categoria → caixa → despesas por grupo (+ sobra ou falta). */
export function sankeyData(facts: FactRow[], lookup: Lookup, limit = 7): SankeyData {
  const incomes = breakdown(facts.filter((fact) => fact.kind === "income"), "group", lookup, limit);
  const expenses = breakdown(facts.filter((fact) => fact.kind === "expense"), "group", lookup, limit);
  const incomeTotal = incomes.reduce((sum, slice) => sum + slice.value, 0);
  const expenseTotal = expenses.reduce((sum, slice) => sum + slice.value, 0);
  if (incomeTotal === 0 && expenseTotal === 0) return { nodes: [], links: [] };

  const nodes: SankeyData["nodes"] = [];
  const links: SankeyData["links"] = [];
  const sources = [...incomes];
  if (expenseTotal > incomeTotal) {
    sources.push({ key: "gap", label: "Faltou (saldo ou dívida)", color: "#ef4444", value: expenseTotal - incomeTotal });
  }
  for (const slice of sources) nodes.push({ name: slice.label, color: slice.color });
  const center = nodes.length;
  nodes.push({ name: "Caixa do período", color: "#7b68ee" });
  sources.forEach((slice, index) => links.push({ source: index, target: center, value: slice.value }));
  const targets = [...expenses];
  if (incomeTotal > expenseTotal) targets.push({ key: "left", label: "Sobrou", color: "#16a34a", value: incomeTotal - expenseTotal });
  for (const slice of targets) {
    links.push({ source: center, target: nodes.length, value: slice.value });
    nodes.push({ name: slice.label, color: slice.color });
  }
  return { nodes, links };
}

export function topFacts(facts: FactRow[], limit = 8): FactRow[] {
  return [...facts].sort((a, b) => b.amountCents - a.amountCents).slice(0, limit);
}

export type KpiResult = {
  value: number | null;
  format: "money" | "percent" | "months";
  hint: string;
  /** Variação contra o período anterior: % (valores) ou pontos percentuais (taxas). */
  delta: number | null;
  /** Subir é bom? (receita sim, despesa não) */
  upIsGood: boolean;
};

export const KPI_LABELS: Record<KpiMetric, string> = {
  income: "Receitas",
  expense: "Despesas",
  net: "Resultado",
  savings_rate: "Taxa de poupança",
  balance: "Saldo em contas",
  card_spend: "Gasto no cartão",
  commitments: "Compromissos por mês",
  debt_ratio: "Renda comprometida com dívidas",
  avg_daily_expense: "Gasto médio por dia",
  emergency_months: "Reserva de emergência",
  loan_balance: "Saldo devedor",
  invoices_open: "Faturas a pagar",
};

const COMMITMENT: Nature[] = ["fixed", "variable", "installment", "loan"];

function metricOf(metric: KpiMetric, facts: FactRow[], monthCount: number): number | null {
  const expenses = facts.filter((fact) => fact.kind === "expense");
  const sum = (rows: FactRow[]) => rows.reduce((total, fact) => total + fact.amountCents, 0);
  const { income, expense, net, savingsRate } = totals(facts);
  switch (metric) {
    case "income":
      return income;
    case "expense":
      return expense;
    case "net":
      return net;
    case "savings_rate":
      return savingsRate;
    case "card_spend":
      return sum(expenses.filter((fact) => fact.cardId));
    case "commitments":
      return Math.round(sum(expenses.filter((fact) => COMMITMENT.includes(fact.nature))) / Math.max(1, monthCount));
    case "debt_ratio":
      return income > 0 ? (sum(expenses.filter((fact) => fact.nature === "loan" || fact.nature === "installment")) / income) * 100 : null;
    default:
      return null;
  }
}

/** Dias corridos do período até hoje (para médias diárias). */
function elapsedDays(from: MonthKey, to: MonthKey, today: Ymd): number {
  const start = `${from}-01`;
  const [y, m] = to.split("-").map(Number);
  const end = `${to}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
  const until = today < end ? today : end;
  return Math.max(1, diffDays(start, until) + 1);
}

export function kpiValue(
  metric: KpiMetric,
  input: { facts: FactRow[]; previous: FactRow[]; from: MonthKey; to: MonthKey; analytics: FinAnalytics; lookup: Lookup }
): KpiResult {
  const { facts, previous, from, to, analytics, lookup } = input;
  const months = monthRange(from, to).length;
  const result = (value: number | null, format: KpiResult["format"], hint: string, upIsGood = true, comparable = false): KpiResult => {
    let delta: number | null = null;
    if (comparable && value !== null && previous.length > 0) {
      const before = metricOf(metric, previous, months);
      if (before !== null && format === "percent") delta = value - before;
      else if (before !== null && before !== 0) delta = ((value - before) / Math.abs(before)) * 100;
    }
    return { value, format, hint, delta, upIsGood };
  };

  switch (metric) {
    case "income":
      return result(metricOf(metric, facts, months), "money", "Tudo que entrou e vai entrar no período", true, true);
    case "expense":
      return result(metricOf(metric, facts, months), "money", "Cartão conta no mês da fatura", false, true);
    case "net": {
      const rate = totals(facts).savingsRate;
      return result(metricOf(metric, facts, months), "money", rate === null ? "Receitas − despesas" : `Você guardou ${rate.toFixed(0)}% da renda`, true, true);
    }
    case "savings_rate":
      return result(metricOf(metric, facts, months), "percent", "Saudável: 20% ou mais", true, true);
    case "card_spend":
      return result(metricOf(metric, facts, months), "money", "Compras nas faturas do período", false, true);
    case "commitments":
      return result(metricOf(metric, facts, months), "money", "Fixas, variáveis, parcelas e empréstimos", false, true);
    case "debt_ratio":
      return result(metricOf(metric, facts, months), "percent", "Parcelas e empréstimos ÷ renda. Ideal: até 30%", false);
    case "balance":
      return result(analytics.currentBalanceCents, "money", "Hoje, nas contas que somam no total");
    case "avg_daily_expense": {
      const realized = facts.filter((fact) => fact.kind === "expense" && fact.realized);
      const total = realized.reduce((sum, fact) => sum + fact.amountCents, 0);
      return result(Math.round(total / elapsedDays(from, to, analytics.today)), "money", "Despesas já realizadas ÷ dias corridos", false);
    }
    case "emergency_months": {
      const expenses = facts.filter((fact) => fact.kind === "expense");
      const essential = expenses.filter((fact) => fact.categoryId && lookup.categories.get(fact.categoryId)?.essential);
      const base = (essential.length ? essential : expenses.filter((fact) => COMMITMENT.includes(fact.nature))).reduce(
        (sum, fact) => sum + fact.amountCents,
        0
      );
      const perMonth = base / Math.max(1, months);
      return result(perMonth > 0 ? analytics.currentBalanceCents / perMonth : null, "months", "Saldo ÷ gastos essenciais por mês. Ideal: 6 meses");
    }
    case "loan_balance": {
      const active = analytics.loans.filter((loan) => loan.remainingCount > 0);
      return result(
        active.reduce((sum, loan) => sum + loan.balanceCents, 0),
        "money",
        active.length ? `${active.length} ${active.length === 1 ? "empréstimo ativo" : "empréstimos ativos"}` : "Nenhum empréstimo ativo",
        false
      );
    }
    case "invoices_open": {
      const open = analytics.invoices.filter((invoice) => invoice.openCents > 0 && invoice.status !== "future");
      return result(open.reduce((sum, invoice) => sum + invoice.openCents, 0), "money", "Faturas abertas, fechadas e vencidas", false);
    }
  }
}

/** Mês de cada ponto do eixo: "2026-11" → dia/mês para tooltips. */
export function monthDays(month: MonthKey): number {
  const { y, m } = parseYmd(`${month}-01`);
  return daysInMonth(y, m);
}
