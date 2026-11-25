// Contas a pagar: o que vence em cada mês, o que já foi pago e o que atrasou.
import { addMonthsToKey, monthOf, monthRange, type MonthKey, type Ymd } from "./dates";
import type { BillStatus, FinBill } from "./types";

export function billStatus(dueDate: Ymd, today: Ymd, paid: boolean): BillStatus {
  if (paid) return "paid";
  if (dueDate < today) return "overdue";
  return dueDate === today ? "today" : "upcoming";
}

const byDueDate = (a: FinBill, b: FinBill) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : b.amountCents - a.amountCents);
const sum = (list: FinBill[]) => list.reduce((total, item) => total + item.amountCents, 0);

/**
 * Contas do mês. No mês atual, o que venceu antes e não foi pago entra junto
 * (ainda precisa ser pago agora).
 */
export function billsForMonth(items: FinBill[], month: MonthKey, today: Ymd) {
  const start = `${month}-01`;
  const current = month === monthOf(today);
  const pending = items
    .filter((item) => item.status !== "paid" && (monthOf(item.dueDate) === month || (current && item.dueDate < start)))
    .sort(byDueDate);
  const paid = items.filter((item) => item.status === "paid" && monthOf(item.dueDate) === month).sort(byDueDate);
  const overdue = pending.filter((item) => item.status === "overdue");
  return {
    pending,
    paid,
    totals: { pendingCents: sum(pending), paidCents: sum(paid), overdueCents: sum(overdue), overdueCount: overdue.length },
  };
}

/**
 * A pagar e pago por mês, do mês atual em diante. Atrasadas contam no mês
 * atual, e `overdueCents` diz quanto do `pendingCents` já venceu.
 */
export function monthsAhead(items: FinBill[], today: Ymd, count = 12) {
  const current = monthOf(today);
  const months = monthRange(current, addMonthsToKey(current, count - 1));
  const map = new Map(months.map((month) => [month, { month, pendingCents: 0, paidCents: 0, overdueCents: 0 }]));
  for (const item of items) {
    const paid = item.status === "paid";
    const bucket = !paid && item.dueDate < `${current}-01` ? current : monthOf(item.dueDate);
    const row = map.get(bucket);
    if (!row) continue;
    if (paid) {
      row.paidCents += item.amountCents;
    } else {
      row.pendingCents += item.amountCents;
      if (item.status === "overdue") row.overdueCents += item.amountCents;
    }
  }
  return [...map.values()];
}
