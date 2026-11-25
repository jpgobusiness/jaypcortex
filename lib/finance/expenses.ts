// Despesas do mês: só o que vence (ou já venceu) naquele mês — no cartão, o vencimento da fatura.
import { addMonthsToKey, isMonthKey, monthOf, monthRange, type MonthKey, type Ymd } from "./dates";
import type { ExpenseStatus, FinExpense } from "./types";

export function expenseStatus(dueDate: Ymd, today: Ymd, paid: boolean): ExpenseStatus {
  if (paid) return "paid";
  if (dueDate < today) return "overdue";
  return "unpaid";
}

/** Mês da despesa na aba Despesas: vencimento na conta, ou vencimento da fatura no cartão. */
export function expenseMonthOf(item: Pick<FinExpense, "dueDate">): MonthKey {
  return monthOf(item.dueDate);
}

const byDueDate = (a: FinExpense, b: FinExpense) =>
  a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : b.amountCents - a.amountCents;

const sum = (list: FinExpense[]) => list.reduce((total, item) => total + item.amountCents, 0);

/**
 * Despesas do mês escolhido. Entra o que vence nesse mês (pago, não pago ou
 * atrasado). Compra de novembro com fatura em dezembro fica em dezembro.
 */
export function expensesForMonth(items: FinExpense[], month: MonthKey, _today: Ymd) {
  const ofMonth = items.filter((item) => expenseMonthOf(item) === month).map((item) => ({ ...item, carried: false }));
  const list = ofMonth.sort(byDueDate);
  const overdue = list.filter((item) => item.status === "overdue");
  return {
    items: list,
    totals: {
      totalCents: sum(list),
      paidCents: sum(list.filter((item) => item.status === "paid")),
      pendingCents: sum(list.filter((item) => item.status === "unpaid")),
      overdueCents: sum(overdue),
      overdueCount: overdue.length,
      carriedOverdueCents: 0,
      carriedOverdueCount: 0,
      monthOverdueCents: sum(overdue),
    },
  };
}

export type ChartPreset = "past12" | "next12" | "m24" | "custom";

const MAX_CHART_MONTHS = 60;

/**
 * Janela do gráfico: 12 meses atrás, 12 à frente, 24 em volta de hoje
 * (11 para trás + atual + 12 à frente) ou de/até personalizado.
 */
export function chartWindow(
  today: Ymd,
  preset: ChartPreset,
  custom?: { from?: string | null; to?: string | null }
): { from: MonthKey; to: MonthKey } {
  const current = monthOf(today);
  if (preset === "past12") return { from: addMonthsToKey(current, -11), to: current };
  if (preset === "next12") return { from: current, to: addMonthsToKey(current, 11) };
  if (preset === "m24") return { from: addMonthsToKey(current, -11), to: addMonthsToKey(current, 12) };
  let from = custom?.from && isMonthKey(custom.from) ? custom.from : addMonthsToKey(current, -11);
  let to = custom?.to && isMonthKey(custom.to) ? custom.to : current;
  if (from > to) [from, to] = [to, from];
  if (monthRange(from, to).length > MAX_CHART_MONTHS) to = addMonthsToKey(from, MAX_CHART_MONTHS - 1);
  return { from, to };
}

/**
 * Totais por mês de vencimento na janela `from`–`to` (inclusive).
 * Atrasada fica no mês em que venceu. Meses sem despesa entram zerados.
 */
export function expenseMonths(items: FinExpense[], from: MonthKey, to: MonthKey) {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const map = new Map(
    monthRange(start, end).map((month) => [month, { month, totalCents: 0, paidCents: 0, pendingCents: 0, overdueCents: 0 }])
  );
  for (const item of items) {
    const row = map.get(expenseMonthOf(item));
    if (!row) continue;
    row.totalCents += item.amountCents;
    if (item.status === "paid") row.paidCents += item.amountCents;
    else if (item.status === "overdue") row.overdueCents += item.amountCents;
    else row.pendingCents += item.amountCents;
  }
  return [...map.values()];
}
