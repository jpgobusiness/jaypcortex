// Ocorrências de um lançamento recorrente (mensal, trimestral, anual...).
import { addDaysYmd, addMonthsToKey, dayInMonth, monthOf, type MonthKey, type Ymd } from "./dates";

export type RecurrenceRule = {
  startDate: Ymd;
  endDate: Ymd | null;
  intervalMonths: number;
  dayOfMonth: number;
};

export type Occurrence = { key: MonthKey; date: Ymd };

/** Quantos meses à frente as recorrências ficam geradas (previsão e dashboards). */
export const RECURRENCE_HORIZON_MONTHS = 12;

/**
 * Ocorrências depois de `afterKey` (exclusive; null = desde o início) até `untilKey`.
 * A primeira ocorrência é sempre a de `startDate`.
 */
export function occurrences(rule: RecurrenceRule, afterKey: MonthKey | null, untilKey: MonthKey): Occurrence[] {
  const list: Occurrence[] = [];
  const startKey = monthOf(rule.startDate);
  for (let step = 0; list.length < 600; step += 1) {
    const key = addMonthsToKey(startKey, step * rule.intervalMonths);
    if (key > untilKey) break;
    const date = step === 0 ? rule.startDate : dayInMonth(key, rule.dayOfMonth);
    if (rule.endDate && date > rule.endDate) break;
    if (afterKey === null || key > afterKey) list.push({ key, date });
  }
  return list;
}

/** Valor mensal equivalente (ex.: bônus trimestral de 3.000 = 1.000 por mês). */
export function monthlyEquivalent(amountCents: number, intervalMonths: number): number {
  return Math.round(amountCents / intervalMonths);
}

/**
 * Ao cancelar: o mês/fatura de hoje fica no histórico; só os seguintes saem.
 * No cartão, `invoiceMonth` é a fatura aberta (pode ser o mês seguinte, se já passou o fechamento).
 * `endDate` = ontem, para a regra aparecer como encerrada hoje.
 */
export function cancelRecurrenceCutoff(today: Ymd, invoiceMonth?: MonthKey): { keepThroughKey: MonthKey; endDate: Ymd } {
  return { keepThroughKey: invoiceMonth ?? monthOf(today), endDate: addDaysYmd(today, -1) };
}
