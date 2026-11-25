// Validação das entradas da API de finanças (mensagens em português).
import { z } from "zod";
import { MAX_CARD_INSTALLMENTS, MAX_LOAN_INSTALLMENTS } from "./constants";
import { isMonthKey, isYmd } from "./dates";

export class FinanceError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

const MAX_CENTS = 2_000_000_000;

const text = (label: string, max: number) =>
  z
    .string({ error: `${label} inválido` })
    .trim()
    .min(1, `Informe: ${label.toLowerCase()}`)
    .max(max, `${label}: até ${max} caracteres`);
const optionalText = (max: number) => z.string().trim().max(max, `Texto longo demais (até ${max})`).optional();
const ymd = z.string().refine(isYmd, "Data inválida");
const monthKey = z.string().refine(isMonthKey, "Mês inválido");
const cents = z
  .number({ error: "Valor inválido" })
  .int("Valor inválido")
  .positive("O valor precisa ser maior que zero")
  .max(MAX_CENTS, "Valor alto demais");
const signedCents = z.number({ error: "Valor inválido" }).int("Valor inválido").min(-MAX_CENTS).max(MAX_CENTS);
const id = z.string().min(1).max(64);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida");
const tags = z.array(z.string().trim().min(1).max(30)).max(10, "Até 10 tags").optional();
const day = z.number({ error: "Dia inválido" }).int().min(1, "Dia inválido").max(31, "Dia inválido");
const interval = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(6), z.literal(12)], { error: "Frequência inválida" });
const flowKind = z.enum(["income", "expense"], { error: "Tipo inválido" });

export const accountInput = z.object({
  name: text("Nome", 60),
  type: z.enum(["checking", "savings", "cash", "investment", "benefit", "other"], { error: "Tipo de conta inválido" }).optional(),
  institution: optionalText(60),
  color: color.optional(),
  initialBalanceCents: signedCents.optional(),
  initialBalanceDate: ymd.optional(),
  includeInTotals: z.boolean().optional(),
});
export const accountPatch = accountInput.partial().extend({
  archived: z.boolean().optional(),
  order: z.number().int().optional(),
  /** Ajustar saldo: o saldo que a conta tem hoje no banco. */
  balanceCents: signedCents.optional(),
});

export const cardInput = z.object({
  name: text("Nome", 60),
  brand: z.enum(["visa", "mastercard", "elo", "amex", "hipercard", "other"], { error: "Bandeira inválida" }).optional(),
  last4: z.string().regex(/^\d{4}$/, "Final do cartão: 4 números").nullable().optional(),
  color: color.optional(),
  limitCents: z.number({ error: "Limite inválido" }).int().min(0, "Limite inválido").max(MAX_CENTS),
  closingDay: day,
  dueDay: day,
  paymentAccountId: id.nullable().optional(),
});
export const cardPatch = cardInput.partial().extend({
  archived: z.boolean().optional(),
  order: z.number().int().optional(),
});

export const invoicePatch = z.object({
  closingDate: ymd.nullable().optional(),
  dueDate: ymd.nullable().optional(),
  notes: optionalText(1000),
});

export const invoicePayment = z.object({
  accountId: id,
  amountCents: cents,
  date: ymd,
});

export const categoryInput = z.object({
  name: text("Nome", 40),
  kind: flowKind,
  icon: z.string().max(40).optional(),
  color: color.optional(),
  parentId: id.nullable().optional(),
  essential: z.boolean().optional(),
});
export const categoryPatch = categoryInput.omit({ kind: true }).partial().extend({
  archived: z.boolean().optional(),
  order: z.number().int().optional(),
});

const flowFields = {
  description: text("Descrição", 120),
  categoryId: id.nullable().optional(),
  tags,
  notes: optionalText(2000),
};

export const entryInput = z.discriminatedUnion(
  "mode",
  [
    z.object({
      mode: z.literal("one_off"),
      kind: flowKind,
      amountCents: cents,
      date: ymd,
      accountId: id,
      paid: z.boolean().optional(),
      ...flowFields,
    }),
    z.object({
      mode: z.literal("card"),
      amountCents: cents,
      date: ymd,
      cardId: id,
      installments: z.number().int().min(1, "Parcelas inválidas").max(MAX_CARD_INSTALLMENTS, `Até ${MAX_CARD_INSTALLMENTS} parcelas`),
      startInstallment: z.number().int().min(1).optional(),
      invoiceMonth: monthKey.optional(),
      ...flowFields,
    }),
    z.object({
      mode: z.literal("recurring"),
      kind: flowKind,
      type: z.enum(["fixed", "variable"]),
      amountCents: cents,
      accountId: id.optional(),
      cardId: id.optional(),
      intervalMonths: interval,
      dayOfMonth: day,
      startDate: ymd,
      endDate: ymd.nullable().optional(),
      firstPaid: z.boolean().optional(),
      ...flowFields,
    }),
    z.object({
      mode: z.literal("transfer"),
      amountCents: cents,
      date: ymd,
      accountId: id,
      toAccountId: id,
      description: optionalText(120),
      tags,
      notes: optionalText(2000),
    }),
  ],
  { error: "Tipo de lançamento inválido" }
);
export type EntryInput = z.infer<typeof entryInput>;

export const transactionPatch = z.object({
  description: text("Descrição", 120).optional(),
  amountCents: signedCents.optional(),
  date: ymd.optional(),
  paidAt: ymd.nullable().optional(),
  /** Pago na aba Despesas — não debita saldo. */
  clearedAt: ymd.nullable().optional(),
  categoryId: id.nullable().optional(),
  accountId: id.nullable().optional(),
  toAccountId: id.optional(),
  /** Troca o cartão. `null` tira a despesa do cartão (precisa de accountId). */
  cardId: id.nullable().optional(),
  invoiceMonth: monthKey.optional(),
  /** Total de parcelas da compra no cartão. Com isto, amountCents é o total da compra. */
  installmentCount: z.number().int().min(1, "Parcelas inválidas").max(MAX_CARD_INSTALLMENTS, `Até ${MAX_CARD_INSTALLMENTS} parcelas`).optional(),
  startInstallment: z.number().int().min(1).optional(),
  tags,
  notes: optionalText(2000),
  /** Compra parcelada: leva descrição, categoria e tags para todas as parcelas. */
  applyToGroup: z.boolean().optional(),
  /** Transforma este lançamento numa despesa/receita recorrente (apaga o original e o grupo). */
  recurrence: z
    .object({
      type: z.enum(["fixed", "variable"]),
      intervalMonths: interval,
      startDate: ymd,
      endDate: ymd.nullable().optional(),
      dayOfMonth: day.optional(),
    })
    .optional(),
});

const recurrenceMonths = z
  .array(z.object({ key: monthKey, amountCents: cents }))
  .max(400, "Histórico longo demais (até 400 meses)")
  .optional();

export const housingRecurrenceInput = z.object({
  system: z.enum(["aluguel", "condominio"], { error: "Informe aluguel ou condomínio" }),
  description: text("Descrição", 120),
  amountCents: cents,
  accountId: id.optional(),
  cardId: id.optional(),
  startDate: ymd,
  months: recurrenceMonths,
});
export type HousingRecurrenceInput = z.infer<typeof housingRecurrenceInput>;

export const recurrencePatch = z.object({
  description: text("Descrição", 120).optional(),
  type: z.enum(["fixed", "variable"]).optional(),
  amountCents: cents.optional(),
  categoryId: id.nullable().optional(),
  accountId: id.optional(),
  cardId: id.optional(),
  intervalMonths: interval.optional(),
  dayOfMonth: day.optional(),
  startDate: ymd.optional(),
  endDate: ymd.nullable().optional(),
  tags,
  notes: optionalText(2000),
  /** Valor de cada mês (aluguel/condomínio). Não apaga o histórico pago. */
  months: recurrenceMonths,
});

export const loanInput = z.object({
  name: text("Nome", 80),
  lender: optionalText(80),
  type: z.enum(["personal", "payroll", "vehicle", "mortgage", "person", "other"]).optional(),
  principalCents: cents,
  feesCents: z.number().int().min(0).max(MAX_CENTS).optional(),
  monthlyRate: z.number({ error: "Taxa inválida" }).min(0, "Taxa inválida").max(99, "Taxa alta demais").optional(),
  installmentCents: cents.optional(),
  amortization: z.enum(["price", "sac"]).optional(),
  installmentCount: z
    .number({ error: "Parcelas inválidas" })
    .int()
    .min(1, "Parcelas inválidas")
    .max(MAX_LOAN_INSTALLMENTS, `Até ${MAX_LOAN_INSTALLMENTS} parcelas`),
  firstDueDate: ymd,
  contractDate: ymd.nullable().optional(),
  paidBeforeCount: z.number().int().min(0).optional(),
  accountId: id,
  categoryId: id.nullable().optional(),
  notes: optionalText(2000),
  disbursement: z.object({ accountId: id, date: ymd, amountCents: cents }).nullable().optional(),
});
export type LoanInput = z.infer<typeof loanInput>;

export const loanSettleInput = z.object({
  scenario: z.enum(["cdc", "nominal"]),
  payoffCents: cents,
  accountId: id.optional(),
});
export type LoanSettleInput = z.infer<typeof loanSettleInput>;

const widget = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(["kpi", "cashflow", "balance", "breakdown", "stacked", "sankey", "top", "agenda", "cards", "loans"]),
  title: z.string().trim().max(80).optional(),
  size: z.enum(["sm", "md", "lg", "full"]),
  metric: z
    .enum([
      "income", "expense", "net", "savings_rate", "balance", "card_spend", "commitments",
      "debt_ratio", "avg_daily_expense", "emergency_months", "loan_balance", "invoices_open",
    ])
    .optional(),
  kind: flowKind.optional(),
  dimension: z.enum(["category", "group", "nature", "payment", "card", "tag", "weekday"]).optional(),
  chart: z.enum(["donut", "bars"]).optional(),
  limit: z.number().int().min(3).max(20).optional(),
  period: z.enum(["month", "last3", "last6", "last12", "year", "next6"]).optional(),
});

export const dashboardInput = z.object({
  name: text("Nome", 60),
  widgets: z.array(widget).max(40, "Até 40 visões por dashboard"),
});
export const dashboardPatch = dashboardInput.partial().extend({ order: z.number().int().optional() });

/** Valida e devolve os dados, ou lança FinanceError com a primeira mensagem. */
export function parseInput<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new FinanceError(issue?.message ?? "Dados inválidos");
  }
  return result.data;
}
