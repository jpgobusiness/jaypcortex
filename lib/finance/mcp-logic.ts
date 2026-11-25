// Texto do Quick → dados de finanças. Sem Prisma: os testes e o binder importam daqui.
import { parseDatePhrase } from "@/lib/activities/dates";
import { asBool } from "@/lib/mcp/quick-compat";
import { MAX_CARD_INSTALLMENTS } from "./constants";
import { isMonthKey, isYmd, monthOf, type MonthKey, type Ymd } from "./dates";
import { formatBRL, toCents } from "./money";
import type { FinAnalytics, FinBill, FinExpense, FinExpenses, FinLoan } from "./types";

export class FinanceToolError extends Error {
  constructor(
    message: string,
    public candidates?: { id: string; label: string }[]
  ) {
    super(message);
  }
}

const MONTH_NAMES = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function fold(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function parseReais(value: unknown): number {
  const cents = toCents(typeof value === "number" ? value : String(value ?? ""));
  if (cents == null || cents <= 0) {
    throw new FinanceToolError("Informe o valor em reais, por exemplo 89,90");
  }
  return cents;
}

export function parseCivilDate(value: unknown, fallback?: Ymd): Ymd {
  const raw = String(value ?? "").trim();
  if (!raw) {
    if (fallback) return fallback;
    throw new FinanceToolError("Informe a data");
  }
  if (isYmd(raw)) return raw;
  const parsed = parseDatePhrase(raw);
  if (!parsed) throw new FinanceToolError("Data inválida. Use hoje, sexta, dia 15 ou AAAA-MM-DD.");
  const ymd = parsed.date.toISOString().slice(0, 10);
  if (!isYmd(ymd)) throw new FinanceToolError("Data inválida");
  return ymd;
}

function monthIndex(name: string) {
  const folded = fold(name);
  const full = MONTH_NAMES.indexOf(folded);
  if (full >= 0) return full;
  const short = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"].indexOf(folded.slice(0, 3));
  return short;
}

export function parseMonthKey(value: unknown, today: Ymd): MonthKey {
  const raw = String(value ?? "").trim();
  if (!raw) return monthOf(today);
  if (isMonthKey(raw)) return raw;
  if (isYmd(raw)) return monthOf(raw);
  const folded = fold(raw);
  const named = folded.match(/([a-z]+)(?:\s+de)?\s+(20\d{2})/);
  if (named) {
    const index = monthIndex(named[1]);
    if (index >= 0) return `${named[2]}-${String(index + 1).padStart(2, "0")}`;
  }
  const slash = folded.match(/^(\d{1,2})[/-](20\d{2})$/);
  if (slash) {
    const month = Number(slash[1]);
    if (month >= 1 && month <= 12) return `${slash[2]}-${String(month).padStart(2, "0")}`;
  }
  const only = monthIndex(folded);
  if (only >= 0) return `${today.slice(0, 4)}-${String(only + 1).padStart(2, "0")}`;
  throw new FinanceToolError("Mês inválido. Use AAAA-MM, novembro 2026 ou novembro.");
}

export function monthFromRequest(request: string, today: Ymd): MonthKey | null {
  const folded = fold(request);
  const iso = folded.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  for (let index = 0; index < MONTH_NAMES.length; index += 1) {
    if (folded.includes(MONTH_NAMES[index])) {
      const year = folded.match(/\b(20\d{2})\b/);
      return `${year?.[1] ?? today.slice(0, 4)}-${String(index + 1).padStart(2, "0")}`;
    }
  }
  return null;
}

export function parseInterval(value: unknown): 1 | 2 | 3 | 6 | 12 {
  const raw = fold(String(value ?? ""));
  if (!raw || raw === "mensal" || raw === "mes" || raw === "todo mes" || raw === "1") return 1;
  if (raw === "bimestral" || raw === "2") return 2;
  if (raw === "trimestral" || raw === "3") return 3;
  if (raw === "semestral" || raw === "6") return 6;
  if (raw === "anual" || raw === "ano" || raw === "12") return 12;
  throw new FinanceToolError("Frequência inválida. Use mensal, bimestral, trimestral, semestral ou anual.");
}

export function intervalLabel(months: number) {
  if (months === 12) return "anual";
  if (months === 6) return "semestral";
  if (months === 3) return "trimestral";
  if (months === 2) return "bimestral";
  return "mensal";
}

export function parseExpenseFilter(value: unknown): "paid" | "unpaid" | "overdue" | "all" {
  const raw = fold(String(value ?? ""));
  if (!raw || raw === "todas" || raw === "all" || raw === "tudo") return "all";
  if (raw === "paga" || raw === "pago" || raw === "pagas" || raw === "paid") return "paid";
  if (raw === "atrasada" || raw === "atrasado" || raw === "atrasadas" || raw === "overdue") return "overdue";
  if (raw === "nao paga" || raw === "nao pago" || raw === "pendente" || raw === "unpaid" || raw === "aberta") return "unpaid";
  throw new FinanceToolError("Status inválido. Use paga, nao paga, atrasada ou todas.");
}

export function parseDeleteScope(value: unknown): "one" | "group" | "future" {
  const raw = fold(String(value ?? ""));
  if (!raw || raw === "one" || raw === "uma" || raw === "esta" || raw === "so esta") return "one";
  if (raw === "group" || raw === "grupo" || raw === "parcelas") return "group";
  if (raw === "future" || raw === "futuras" || raw === "proximas") return "future";
  throw new FinanceToolError("Escopo inválido. Use one (só esta), group (parcelas) ou future (esta e as próximas).");
}

export function parseOptionalPaid(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === false) return false;
  if (value === true) return true;
  const raw = fold(String(value));
  if (raw === "false" || raw === "0" || raw === "nao" || raw === "nao pago" || raw === "pendente") return false;
  if (raw === "true" || raw === "1" || raw === "sim" || raw === "pago" || raw === "paga" || raw === "paid") return true;
  throw new FinanceToolError("paid inválido. Use true ou false.");
}

export function confirmed(value: unknown) {
  return asBool(value) || fold(String(value ?? "")) === "sim";
}

export function parseInstallments(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 1;
  const count = Number(raw.replace(",", "."));
  if (!Number.isInteger(count) || count < 1 || count > MAX_CARD_INSTALLMENTS) {
    throw new FinanceToolError(`Parcelas: de 1 a ${MAX_CARD_INSTALLMENTS}`);
  }
  return count;
}

export function parseHousingSystem(value: unknown): "aluguel" | "condominio" {
  const raw = fold(String(value ?? ""));
  if (raw === "aluguel") return "aluguel";
  if (raw === "condominio") return "condominio";
  throw new FinanceToolError("Informe aluguel ou condominio");
}

export function parseChartPreset(value: unknown): "past12" | "next12" | "m24" | "custom" {
  const raw = fold(String(value ?? ""));
  if (!raw || raw === "past12" || raw === "12_atras" || raw === "passados") return "past12";
  if (raw === "next12" || raw === "12_frente" || raw === "futuros") return "next12";
  if (raw === "m24" || raw === "24") return "m24";
  if (raw === "custom" || raw === "periodo") return "custom";
  throw new FinanceToolError("preset inválido. Use past12, next12, m24 ou from/to.");
}

export function dayOf(value: Ymd) {
  return Number(value.slice(8, 10));
}

export function textOf(value: unknown) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

const STATUS_LABEL = { paid: "Paga", unpaid: "Não paga", overdue: "Atrasada" } as const;

export function presentExpense(
  item: FinExpense,
  names: { category?: string | null; account?: string | null; card?: string | null }
) {
  return {
    id: item.id,
    description: item.description,
    detail: item.detail,
    amount: formatBRL(item.amountCents),
    amount_cents: item.amountCents,
    date: item.date,
    due_date: item.dueDate,
    status: item.status,
    status_label: STATUS_LABEL[item.status],
    category: names.category ?? null,
    account: names.account ?? null,
    card: names.card ?? null,
    nature: item.nature,
    installment: item.installmentNumber && item.installmentCount ? `${item.installmentNumber}/${item.installmentCount}` : null,
    recurring: Boolean(item.transaction?.recurrenceId),
    loan: Boolean(item.loanId),
    notes: item.notes,
    essential: item.essential,
    carried: item.carried,
  };
}

export function expenseDashboard(data: FinExpenses, categoryNames: Map<string, string>) {
  const byCategory = new Map<string, { category: string; cents: number; count: number }>();
  for (const item of data.items) {
    const category = (item.categoryId && categoryNames.get(item.categoryId)) || "Sem categoria";
    const row = byCategory.get(category) ?? { category, cents: 0, count: 0 };
    row.cents += item.amountCents;
    row.count += 1;
    byCategory.set(category, row);
  }
  return {
    today: data.today,
    month: data.month,
    totals: {
      total: formatBRL(data.totals.totalCents),
      paid: formatBRL(data.totals.paidCents),
      unpaid: formatBRL(data.totals.pendingCents),
      overdue: formatBRL(data.totals.overdueCents),
      overdue_count: data.totals.overdueCount,
      total_cents: data.totals.totalCents,
      paid_cents: data.totals.paidCents,
      unpaid_cents: data.totals.pendingCents,
      overdue_cents: data.totals.overdueCents,
    },
    by_category: [...byCategory.values()]
      .sort((a, b) => b.cents - a.cents)
      .map((row) => ({ category: row.category, total: formatBRL(row.cents), total_cents: row.cents, count: row.count })),
    months: data.months.map((row) => ({
      month: row.month,
      total: formatBRL(row.totalCents),
      paid: formatBRL(row.paidCents),
      pending: formatBRL(row.pendingCents),
      overdue: formatBRL(row.overdueCents),
      total_cents: row.totalCents,
      paid_cents: row.paidCents,
      pending_cents: row.pendingCents,
      overdue_cents: row.overdueCents,
    })),
    note: "Totais prontos para dashboard. Use totals, by_category e months. Não some a lista de itens de novo.",
  };
}

export function expenseLive(data: FinExpenses) {
  const dash = expenseDashboard(data, new Map());
  return {
    today: data.today,
    month: data.month,
    count: data.items.length,
    totals: dash.totals,
    months: dash.months,
    overdue: data.items
      .filter((item) => item.status === "overdue")
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        description: item.description,
        due_date: item.dueDate,
        amount: formatBRL(item.amountCents),
      })),
    note: dash.note,
  };
}

export function presentBill(bill: FinBill) {
  return {
    id: bill.id,
    description: bill.description,
    detail: bill.detail,
    due_date: bill.dueDate,
    amount: formatBRL(bill.amountCents),
    amount_cents: bill.amountCents,
    status: bill.status,
    origin: bill.origin.label,
  };
}

export function presentLoan(loan: FinLoan) {
  return {
    id: loan.id,
    name: loan.name,
    lender: loan.lender,
    balance: formatBRL(loan.balanceCents),
    balance_cents: loan.balanceCents,
    installment: loan.installmentCents == null ? null : formatBRL(loan.installmentCents),
    remaining: loan.remainingCount,
    overdue: loan.overdueCount,
    first_due: loan.firstDueDate,
  };
}

export function presentAnalytics(data: FinAnalytics) {
  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const fact of data.facts) {
    const row = byMonth.get(fact.month) ?? { income: 0, expense: 0 };
    row[fact.kind] += fact.amountCents;
    byMonth.set(fact.month, row);
  }
  let income = 0;
  let expense = 0;
  const months = [...byMonth.entries()].map(([month, row]) => {
    income += row.income;
    expense += row.expense;
    return {
      month,
      income: formatBRL(row.income),
      expense: formatBRL(row.expense),
      net: formatBRL(row.income - row.expense),
      income_cents: row.income,
      expense_cents: row.expense,
      net_cents: row.income - row.expense,
    };
  });
  return {
    from: data.from,
    to: data.to,
    today: data.today,
    saldo: formatBRL(data.currentBalanceCents),
    saldo_cents: data.currentBalanceCents,
    receitas: formatBRL(income),
    despesas: formatBRL(expense),
    resultado: formatBRL(income - expense),
    receitas_cents: income,
    despesas_cents: expense,
    resultado_cents: income - expense,
    months,
    invoices: data.invoices.slice(0, 12).map((invoice) => ({
      card_id: invoice.cardId,
      month: invoice.month,
      due_date: invoice.dueDate,
      open: formatBRL(invoice.openCents),
      open_cents: invoice.openCents,
      status: invoice.status,
    })),
    loans: data.loans.map((loan) => presentLoan(loan)),
    note: "Série pronta para dashboard. Use months e os totais. Não some de novo.",
  };
}

export function isFinanceAsk(request: string) {
  const text = fold(request);
  const finance = /\b(despesa|despesas|gasto|gastos|boleto|aluguel|condominio|fatura|financeiro|financas|saldo|recorrente|cartao)\b/.test(text);
  if (!finance) return false;
  if (/\b(tarefa|atividade)\b/.test(text) && !/\b(despesa|gasto|boleto|fatura)\b/.test(text)) return false;
  return true;
}

export function financeToolPlan(request: string): string[] {
  const text = fold(request);
  if (/\bfatura\b/.test(text) && /\b(paga|pagar|quite)\b/.test(text)) return ["list_finance_options", "pay_card_invoice"];
  if (/\b(apaga|exclui|remove|cancela)\b/.test(text)) return ["search_expenses", "delete_expense"];
  if (/\b(marca como paga|marcar como paga|paga a despesa|pagar a despesa|desmarca)\b/.test(text)) {
    return ["search_expenses", "pay_expense"];
  }
  if (/\btransfer/.test(text)) return ["list_finance_options", "create_transfer"];
  if (/\b(cria|cadastra|lanca)\b/.test(text)) {
    if (/\b(receita|recebi|entrou)\b/.test(text)) return ["list_finance_options", "create_income"];
    if (/aluguel|condominio/.test(text)) return ["list_finance_options", "create_housing_expense"];
    if (/recorrente|todo mes|mensal|assinatura/.test(text)) return ["list_finance_options", "create_recurring_expense"];
    if (/cartao|parcela/.test(text)) return ["list_finance_options", "create_card_expense"];
    return ["list_finance_options", "create_expense"];
  }
  if (/\b(atualiza|edita|altera|muda o valor)\b/.test(text)) return ["search_expenses", "update_expense"];
  if (/dashboard|grafico|resumo|quanto gastei|como esta|como ta/.test(text)) {
    return ["expense_report", "finance_snapshot", "finance_analytics"];
  }
  if (/emprestimo/.test(text)) return ["list_loans"];
  if (/recorrente|assinatura/.test(text)) return ["list_recurring_expenses", "search_expenses"];
  if (/conta a pagar|boleto|venc/.test(text)) return ["list_bills", "list_expenses"];
  return ["list_expenses", "search_expenses", "expense_report"];
}
