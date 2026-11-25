// Plano de parcelas no cartão (sem banco): datas, faturas e total da compra.
import { addMonthsToKey, addMonthsYmd, monthOf, parseYmd, type MonthKey, type Ymd } from "./dates";
import { splitInstallments } from "./money";

/** Quantos meses de `from` até `to` (negativo se `to` for antes). */
export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const a = parseYmd(`${from}-01`);
  const b = parseYmd(`${to}-01`);
  return (b.y - a.y) * 12 + (b.m - a.m);
}

/**
 * Parcela em que a compra está em `asOf`, se começou em `purchaseDate`.
 * Set/25 com 21x em nov/26 → 15. Se já acabou, devolve a última.
 */
export function currentCardInstallment(purchaseDate: Ymd, count: number, asOf: Ymd): number {
  if (count < 1) return 1;
  const elapsed = monthsBetween(monthOf(purchaseDate), monthOf(asOf)) + 1;
  return Math.min(count, Math.max(1, elapsed));
}

/** Data da compra original a partir da data desta parcela. */
export function purchaseDateOf(date: Ymd, installmentNumber: number | null | undefined): Ymd {
  const number = installmentNumber ?? 1;
  return number > 1 ? addMonthsYmd(date, 1 - number) : date;
}

/** Total da compra a partir das parcelas que ainda existem. */
export function purchaseTotalFromSiblings(
  siblings: { installmentNumber: number | null; amountCents: number }[],
  count: number
): number {
  if (siblings.length === 0) return 0;
  if (count <= 1) return Math.abs(siblings[0].amountCents);
  const first = siblings.find((row) => (row.installmentNumber ?? 1) === 1);
  const later = siblings.find((row) => (row.installmentNumber ?? 1) > 1);
  if (first && later) return first.amountCents + later.amountCents * (count - 1);
  if (later) return later.amountCents * count;
  if (first) return first.amountCents;
  return siblings.reduce((sum, row) => sum + row.amountCents, 0);
}

export type PlannedInstallment = {
  number: number;
  amountCents: number;
  date: Ymd;
  invoiceMonth: MonthKey;
};

/** Gera as parcelas que ainda entram no cartão (da parcela `start` até `count`). */
export function planCardInstallments(input: {
  purchaseDate: Ymd;
  totalCents: number;
  count: number;
  start: number;
  firstInvoice: MonthKey;
}): PlannedInstallment[] {
  const amounts = splitInstallments(input.totalCents, input.count);
  const rows: PlannedInstallment[] = [];
  for (let number = input.start; number <= input.count; number += 1) {
    rows.push({
      number,
      amountCents: amounts[number - 1],
      date: addMonthsYmd(input.purchaseDate, number - 1),
      invoiceMonth: addMonthsToKey(input.firstInvoice, number - 1),
    });
  }
  return rows;
}
