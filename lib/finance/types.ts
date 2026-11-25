// Tipos do módulo de finanças trocados entre API e tela. Valores em centavos.
import type { Nature, TransactionKind } from "./constants";
import type { MonthKey, Ymd } from "./dates";
import type { InvoiceSummary } from "./invoice";
import type { PayoffQuote, ScheduleRow } from "./loan";

export type FlowKind = "income" | "expense";

export type FinAccount = {
  id: string;
  name: string;
  type: string;
  institution: string;
  color: string;
  initialBalanceCents: number;
  initialBalanceDate: Ymd;
  includeInTotals: boolean;
  archived: boolean;
  order: number;
  /** Saldo hoje (só o que já foi pago/recebido). */
  balanceCents: number;
  pendingInCents: number;
  pendingOutCents: number;
};

export type FinInvoice = InvoiceSummary;

export type FinCard = {
  id: string;
  name: string;
  brand: string;
  last4: string | null;
  color: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string | null;
  archived: boolean;
  order: number;
  /** Compras ainda não pagas, inclusive parcelas futuras. */
  usedCents: number;
  availableCents: number;
  openInvoice: FinInvoice;
  /** Fatura fechada (ou vencida) com saldo a pagar, se houver. */
  dueInvoice: FinInvoice | null;
};

export type FinCategory = {
  id: string;
  name: string;
  kind: FlowKind;
  icon: string;
  color: string;
  parentId: string | null;
  essential: boolean;
  system: string | null;
  archived: boolean;
  order: number;
};

export type TransactionStatus = "paid" | "pending" | "overdue" | "card";

export type FinTransaction = {
  id: string;
  kind: TransactionKind;
  description: string;
  amountCents: number;
  date: Ymd;
  paidAt: Ymd | null;
  accountId: string | null;
  toAccountId: string | null;
  cardId: string | null;
  invoiceMonth: MonthKey | null;
  categoryId: string | null;
  recurrenceId: string | null;
  recurrenceKey: string | null;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  loanId: string | null;
  interestCents: number | null;
  tags: string[];
  notes: string;
  nature: Nature | null;
  status: TransactionStatus;
};

export type FinInvoiceDetail = FinInvoice & {
  charges: FinTransaction[];
  payments: FinTransaction[];
};

export type FinRecurrence = {
  id: string;
  kind: FlowKind;
  type: "fixed" | "variable";
  description: string;
  amountCents: number;
  categoryId: string | null;
  accountId: string | null;
  cardId: string | null;
  intervalMonths: number;
  dayOfMonth: number;
  startDate: Ymd;
  endDate: Ymd | null;
  tags: string[];
  notes: string;
  /** Valor por mês (bônus trimestral de 3.000 = 1.000/mês). */
  monthlyCents: number;
  nextDate: Ymd | null;
  pendingCount: number;
  paidCount: number;
  ended: boolean;
  /** Aluguel ou condomínio: cada mês tem o próprio valor. */
  housing: boolean;
};

export type FinRecurrenceMonth = {
  key: MonthKey;
  date: Ymd;
  amountCents: number;
  transactionId: string;
  paidAt: Ymd | null;
  period: "past" | "current" | "future";
};

export type FinRecurrenceDetail = FinRecurrence & {
  months: FinRecurrenceMonth[];
};

export type LoanRowStatus = "paid_before" | "paid" | "pending" | "overdue" | "settled";

export type FinLoan = {
  id: string;
  name: string;
  lender: string;
  type: string;
  principalCents: number;
  feesCents: number;
  monthlyRate: number;
  annualRate: number;
  amortization: "price" | "sac";
  installmentCount: number;
  installmentCents: number | null;
  firstDueDate: Ymd;
  contractDate: Ymd | null;
  paidBeforeCount: number;
  accountId: string | null;
  categoryId: string | null;
  notes: string;
  paidCount: number;
  remainingCount: number;
  overdueCount: number;
  /** Soma das parcelas em aberto (ex.: 9 × R$ 1.345). */
  balanceCents: number;
  /** Principal que ainda deve na tabela Price/SAC. */
  principalRemainingCents: number;
  interestPaidCents: number;
  interestRemainingCents: number;
  totalInterestCents: number;
  totalCostCents: number;
  nextDue: { date: Ymd; amountCents: number; transactionId: string } | null;
  cet: { monthly: number; annual: number } | null;
  payoff: { payoffCents: number; nominalCents: number; savingsCents: number };
};

export type FinLoanDetail = FinLoan & {
  schedule: (ScheduleRow & { status: LoanRowStatus; transactionId: string | null; paidAt: Ymd | null })[];
  quotes: PayoffQuote[];
  settlement: { transactionId: string; date: Ymd; amountCents: number } | null;
};

export type BillStatus = "overdue" | "today" | "upcoming" | "paid";

/** Situação na aba Despesas: pago, não pago ou atrasado. */
export type ExpenseStatus = "paid" | "unpaid" | "overdue";

/** Uma conta a pagar: lançamento da conta (boleto, parcela, dívida) ou fatura de cartão. */
export type FinBill = {
  id: string;
  source: "transaction" | "invoice";
  description: string;
  detail: string;
  dueDate: Ymd;
  amountCents: number;
  status: BillStatus;
  paidAt: Ymd | null;
  /** Grupo do gráfico "por origem": cada cartão, empréstimos, dívidas com pessoas, fixas... */
  origin: { key: string; label: string; color: string };
  accountId: string | null;
  cardId: string | null;
  invoiceMonth: MonthKey | null;
  /** Fatura ainda aberta: pode crescer com novas compras. */
  invoiceOpen: boolean;
  transaction: FinTransaction | null;
};

export type FinBills = {
  today: Ymd;
  month: MonthKey;
  pending: FinBill[];
  paid: FinBill[];
  totals: { pendingCents: number; paidCents: number; overdueCents: number; overdueCount: number };
  /**
   * A pagar e pago de cada mês, do mês atual até 11 meses à frente. O mês atual
   * inclui as atrasadas; `overdueCents` é a parte do a pagar que já venceu.
   */
  months: { month: MonthKey; pendingCents: number; paidCents: number; overdueCents: number }[];
};

/** Uma despesa do mês: pontual, fixa, variável, cartão, parcela ou empréstimo. */
export type FinExpense = {
  id: string;
  description: string;
  detail: string;
  amountCents: number;
  /** Data da despesa (vencimento na conta, ou dia da compra no cartão). */
  date: Ymd;
  /** Vencimento que define o mês na aba Despesas: na conta a mesma data; no cartão, o da fatura. */
  dueDate: Ymd;
  paidAt: Ymd | null;
  /** Marcado como pago na tabela de Despesas — não debita saldo. */
  clearedAt: Ymd | null;
  status: ExpenseStatus;
  nature: Nature;
  categoryId: string | null;
  accountId: string | null;
  cardId: string | null;
  invoiceMonth: MonthKey | null;
  loanId: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  tags: string[];
  notes: string;
  essential: boolean;
  /** Atrasada de um mês anterior, puxada para o mês atual. */
  carried: boolean;
  /** Fatura desta compra já passou do vencimento. */
  invoiceOverdue: boolean;
  transaction: FinTransaction;
};

export type FinExpenses = {
  today: Ymd;
  month: MonthKey;
  items: FinExpense[];
  totals: {
    totalCents: number;
    paidCents: number;
    pendingCents: number;
    overdueCents: number;
    overdueCount: number;
    carriedOverdueCents: number;
    carriedOverdueCount: number;
    monthOverdueCents: number;
  };
  /**
   * Despesas por mês de vencimento (no cartão, vencimento da fatura).
   * Janela do gráfico: 12 anteriores, 12 à frente, 24 meses ou período personalizado.
   */
  months: {
    month: MonthKey;
    totalCents: number;
    paidCents: number;
    pendingCents: number;
    overdueCents: number;
  }[];
};

export type FinBootstrap = {
  today: Ymd;
  accounts: FinAccount[];
  cards: FinCard[];
  categories: FinCategory[];
};

/** Linha-fato das visões (só receitas e despesas). `month` = mês de caixa. */
export type FactRow = {
  id: string;
  kind: FlowKind;
  month: MonthKey;
  date: Ymd;
  amountCents: number;
  realized: boolean;
  categoryId: string | null;
  accountId: string | null;
  cardId: string | null;
  nature: Nature;
  description: string;
  tags: string[];
  interestCents: number;
  loanId: string | null;
};

export type BalancePoint = { month: MonthKey; balanceCents: number; projected: boolean };

export type AgendaItem = {
  id: string;
  source: "transaction" | "invoice";
  kind: FlowKind;
  description: string;
  date: Ymd;
  amountCents: number;
  overdue: boolean;
  accountId: string | null;
  cardId: string | null;
  invoiceMonth: MonthKey | null;
};

export type FinAnalytics = {
  today: Ymd;
  from: MonthKey;
  to: MonthKey;
  facts: FactRow[];
  balance: BalancePoint[];
  currentBalanceCents: number;
  agenda: AgendaItem[];
  invoices: FinInvoice[];
  loans: FinLoan[];
};

// ---- Dashboards ----

export type WidgetType =
  | "kpi"
  | "cashflow"
  | "balance"
  | "breakdown"
  | "stacked"
  | "sankey"
  | "top"
  | "agenda"
  | "cards"
  | "loans";

export type KpiMetric =
  | "income"
  | "expense"
  | "net"
  | "savings_rate"
  | "balance"
  | "card_spend"
  | "commitments"
  | "debt_ratio"
  | "avg_daily_expense"
  | "emergency_months"
  | "loan_balance"
  | "invoices_open";

export type Dimension = "category" | "group" | "nature" | "payment" | "card" | "tag" | "weekday";

export type PeriodPreset = "month" | "last3" | "last6" | "last12" | "year" | "next6";

export type WidgetSize = "sm" | "md" | "lg" | "full";

export type WidgetConfig = {
  id: string;
  type: WidgetType;
  title?: string;
  size: WidgetSize;
  metric?: KpiMetric;
  kind?: FlowKind;
  dimension?: Dimension;
  chart?: "donut" | "bars";
  limit?: number;
  /** Período próprio do widget. Sem ele, usa o período do dashboard. */
  period?: PeriodPreset;
};

export type FinDashboard = {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  order: number;
  updatedAt: string;
};
