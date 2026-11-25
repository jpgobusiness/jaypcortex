// Regras de fatura de cartão. Iguais às funções fin_* da migration de finanças.
import { addMonthsToKey, dayInMonth, monthOf, nextBusinessDay, type MonthKey, type Ymd } from "./dates";

export type CardDays = { closingDay: number; dueDay: number };

/**
 * Fatura ("YYYY-MM" do vencimento) em que entra uma compra feita em `purchase`.
 * O dia do fechamento é o melhor dia de compra: a partir dele a compra vai
 * para a fatura seguinte.
 */
export function invoiceMonthFor(purchase: Ymd, { closingDay, dueDay }: CardDays): MonthKey {
  const month = monthOf(purchase);
  const closingMonth = purchase >= dayInMonth(month, closingDay) ? addMonthsToKey(month, 1) : month;
  return dueDay > closingDay ? closingMonth : addMonthsToKey(closingMonth, 1);
}

/** Mês em que a fatura `month` fecha. */
function closingMonthOf(month: MonthKey, { closingDay, dueDay }: CardDays): MonthKey {
  return dueDay > closingDay ? month : addMonthsToKey(month, -1);
}

export type InvoiceOverride = { closingDate?: Ymd | null; dueDate?: Ymd | null };

/** Datas de fechamento e vencimento (ajustes manuais da fatura têm prioridade). */
export function invoiceDates(month: MonthKey, card: CardDays, override?: InvoiceOverride | null) {
  return {
    closingDate: override?.closingDate ?? dayInMonth(closingMonthOf(month, card), card.closingDay),
    dueDate: override?.dueDate ?? nextBusinessDay(dayInMonth(month, card.dueDay)),
  };
}

export type InvoiceStatus = "open" | "future" | "closed" | "overdue" | "paid";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  open: "Aberta",
  future: "Futura",
  closed: "Fechada",
  overdue: "Vencida",
  paid: "Paga",
};

export type InvoiceSummary = {
  cardId: string;
  month: MonthKey;
  closingDate: Ymd;
  dueDate: Ymd;
  totalCents: number;
  paidCents: number;
  openCents: number;
  count: number;
  status: InvoiceStatus;
  notes: string;
  customDates: boolean;
};

/**
 * Faturas de um cartão a partir das somas por mês (compras e pagamentos).
 * A fatura aberta sempre aparece, mesmo sem compras.
 */
export function summarizeInvoices(input: {
  card: CardDays & { id: string };
  movements: { month: MonthKey; kind: string; cents: number; count: number }[];
  overrides: { month: MonthKey; closingDate: Ymd | null; dueDate: Ymd | null; notes: string }[];
  today: Ymd;
}): InvoiceSummary[] {
  const { card, today } = input;
  const openMonth = invoiceMonthFor(today, card);
  const byMonth = new Map<MonthKey, { total: number; paid: number; count: number }>();
  const touch = (month: MonthKey) => {
    const row = byMonth.get(month) ?? { total: 0, paid: 0, count: 0 };
    byMonth.set(month, row);
    return row;
  };
  touch(openMonth);
  for (const movement of input.movements) {
    const row = touch(movement.month);
    if (movement.kind === "expense") {
      row.total += movement.cents;
      row.count += movement.count;
    } else if (movement.kind === "card_payment") {
      row.paid += movement.cents;
    }
  }
  const overrides = new Map(input.overrides.map((item) => [item.month, item]));
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, row]) => {
      const override = overrides.get(month);
      const { closingDate, dueDate } = invoiceDates(month, card, override);
      return {
        cardId: card.id,
        month,
        closingDate,
        dueDate,
        totalCents: row.total,
        paidCents: row.paid,
        openCents: Math.max(0, row.total - row.paid),
        count: row.count,
        status: invoiceStatus({ month, openMonth, totalCents: row.total, paidCents: row.paid, dueDate, today }),
        notes: override?.notes ?? "",
        customDates: Boolean(override?.closingDate || override?.dueDate),
      };
    });
}

/**
 * Situação da fatura. `openMonth` é a fatura que recebe as compras de hoje.
 * Fatura sem nada a pagar depois de fechada conta como paga.
 */
export function invoiceStatus(input: {
  month: MonthKey;
  openMonth: MonthKey;
  totalCents: number;
  paidCents: number;
  dueDate: Ymd;
  today: Ymd;
}): InvoiceStatus {
  const { month, openMonth, totalCents, paidCents, dueDate, today } = input;
  if (totalCents > 0 && paidCents >= totalCents) return "paid";
  if (month === openMonth) return "open";
  if (month > openMonth) return "future";
  if (totalCents - paidCents <= 0) return "paid";
  return today > dueDate ? "overdue" : "closed";
}
