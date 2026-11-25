import { z } from "zod";
import { todayYmd, type Ymd } from "@/lib/finance/dates";
import {
  confirmed,
  dayOf,
  FinanceToolError,
  parseChartPreset,
  parseCivilDate,
  parseDeleteScope,
  parseExpenseFilter,
  parseHousingSystem,
  parseInstallments,
  parseInterval,
  parseMonthKey,
  parseOptionalPaid,
  parseReais,
  textOf,
} from "@/lib/finance/mcp-logic";
import { readMeta, writeMeta, type ToolServer } from "@/lib/mcp/annotations";

const str = z.string().optional();

export const listExpensesSchema = z.object({ month: str, status: str, q: str });
export const getExpenseSchema = z.object({ id: str, query: str });
export const searchExpensesSchema = z.object({ q: str, month: str });
export const expenseReportSchema = z.object({ preset: str, from: str, to: str });
export const monthSchema = z.object({ month: str });
export const analyticsSchema = z.object({ from: str, to: str });
export const createExpenseSchema = z.object({
  description: z.string(),
  amount: z.string(),
  date: str,
  account: str,
  category: str,
  paid: str,
  notes: str,
});
export const createRecurringSchema = z.object({
  description: z.string(),
  amount: z.string(),
  account: str,
  card: str,
  category: str,
  start_date: str,
  interval: str,
  end_date: str,
});
export const createCardSchema = z.object({
  description: z.string(),
  amount: z.string(),
  card: z.string(),
  date: str,
  installments: str,
  category: str,
  notes: str,
});
export const createHousingSchema = z.object({
  system: z.string(),
  amount: z.string(),
  start_date: str,
  account: str,
  card: str,
  description: str,
});
export const updateExpenseSchema = z.object({
  id: str,
  query: str,
  description: str,
  amount: str,
  date: str,
  category: str,
  account: str,
  notes: str,
});
export const payExpenseSchema = z.object({ id: str, query: str, paid: str, date: str });
export const deleteExpenseSchema = z.object({ id: str, query: str, confirm: str, scope: str });
export const createTransferSchema = z.object({
  amount: z.string(),
  date: str,
  from_account: z.string(),
  to_account: z.string(),
  description: str,
});
export const payInvoiceSchema = z.object({
  card: z.string(),
  month: str,
  account: str,
  amount: z.string(),
  date: str,
});

export type ExpenseRef = { id?: string; query?: string };

export type ExpenseDraft = {
  description: string;
  amountCents: number;
  date: Ymd;
  account?: string;
  category?: string;
  paid?: boolean;
  notes?: string;
};

export type RecurringDraft = {
  description: string;
  amountCents: number;
  account?: string;
  card?: string;
  category?: string;
  startDate: Ymd;
  intervalMonths: 1 | 2 | 3 | 6 | 12;
  dayOfMonth: number;
  endDate?: Ymd;
};

export type CardDraft = {
  description: string;
  amountCents: number;
  card: string;
  date: Ymd;
  installments: number;
  category?: string;
  notes?: string;
};

export type HousingDraft = {
  system: "aluguel" | "condominio";
  description: string;
  amountCents: number;
  startDate: Ymd;
  account?: string;
  card?: string;
};

export type ExpensePatch = {
  description?: string;
  amountCents?: number;
  date?: Ymd;
  category?: string;
  account?: string;
  notes?: string;
};

export type TransferDraft = {
  amountCents: number;
  date: Ymd;
  fromAccount: string;
  toAccount: string;
  description?: string;
};

export type InvoicePayDraft = {
  card: string;
  month: string;
  account?: string;
  amountCents: number;
  date: Ymd;
};

export type FinanceToolApi = {
  listExpenses(opts: { month: string; status: "paid" | "unpaid" | "overdue" | "all"; q?: string }): Promise<unknown>;
  getExpense(ref: ExpenseRef): Promise<unknown>;
  searchExpenses(q: string, month?: string): Promise<unknown>;
  report(opts: { preset: "past12" | "next12" | "m24" | "custom"; from?: string; to?: string }): Promise<unknown>;
  snapshot(month: string): Promise<unknown>;
  bills(month: string): Promise<unknown>;
  options(): Promise<unknown>;
  recurrences(): Promise<unknown>;
  loans(): Promise<unknown>;
  analytics(opts: { from?: string; to?: string }): Promise<unknown>;
  createExpense(input: ExpenseDraft): Promise<unknown>;
  createRecurring(input: RecurringDraft): Promise<unknown>;
  createCard(input: CardDraft): Promise<unknown>;
  createHousing(input: HousingDraft): Promise<unknown>;
  updateExpense(ref: ExpenseRef, patch: ExpensePatch): Promise<unknown>;
  payExpense(ref: ExpenseRef, paid: boolean, date: Ymd): Promise<unknown>;
  deleteExpense(ref: ExpenseRef, scope: "one" | "group" | "future"): Promise<unknown>;
  createIncome(input: ExpenseDraft): Promise<unknown>;
  createTransfer(input: TransferDraft): Promise<unknown>;
  payInvoice(input: InvoicePayDraft): Promise<unknown>;
};

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function allows(scopes: string[], needed: "read" | "write") {
  if (scopes.includes("admin")) return true;
  return scopes.includes(needed);
}

function required(value: unknown, label: string) {
  const textValue = String(value ?? "").trim();
  if (!textValue) throw new FinanceToolError(`Informe ${label}`);
  return textValue;
}

function refOf(args: { id?: string; query?: string }): ExpenseRef {
  return { id: textOf(args.id), query: textOf(args.query) };
}

async function run(fn: () => Promise<unknown>) {
  try {
    return text(await fn());
  } catch (error) {
    if (error instanceof FinanceToolError) return text({ error: error.message, candidates: error.candidates });
    if (error instanceof Error) return text({ error: error.message });
    throw error;
  }
}

export function bindFinanceTools(
  server: ToolServer,
  ctx: { scopes: string[] },
  api: FinanceToolApi
) {
  const gate = (needed: "read" | "write", fn: () => Promise<unknown>) => {
    if (!allows(ctx.scopes, needed)) return text({ error: "Token sem permissão para esta tool" });
    return run(fn);
  };

  server.registerTool("list_expenses", {
    ...readMeta("Listar despesas"),
    description: "Lista as despesas de um mês. No cartão, o mês é o vencimento da fatura. month: AAAA-MM ou novembro. status: paga, nao paga, atrasada ou todas. q filtra o texto. A resposta traz totais em reais prontos para dashboard.",
    inputSchema: listExpensesSchema,
  }, async (args) => gate("read", async () => {
    const today = todayYmd();
    return api.listExpenses({
      month: parseMonthKey(args.month, today),
      status: parseExpenseFilter(args.status),
      q: textOf(args.q),
    });
  }));

  server.registerTool("get_expense", {
    ...readMeta("Ver despesa"),
    description: "Detalhe de uma despesa: valor, vencimento, Paga/Não paga/Atrasada, conta, cartão e categoria. Informe id ou query. Se houver mais de uma, devolve os candidatos em vez de escolher.",
    inputSchema: getExpenseSchema,
  }, async (args) => gate("read", () => api.getExpense(refOf(args))));

  server.registerTool("search_expenses", {
    ...readMeta("Buscar despesa"),
    description: "Procura despesa pelo texto em qualquer mês. Use para saber se já existe (Netflix, aluguel, luz) e qual a data. q com pelo menos 2 letras. month é opcional.",
    inputSchema: searchExpensesSchema,
  }, async (args) => gate("read", async () => {
    const q = required(args.q, "o texto da busca");
    if (q.length < 2) throw new FinanceToolError("Informe pelo menos 2 letras");
    return api.searchExpenses(q, textOf(args.month) ? parseMonthKey(args.month, todayYmd()) : undefined);
  }));

  server.registerTool("expense_report", {
    ...readMeta("Relatório de despesas"),
    description: "Série mensal pronta para gráfico: total, pago, pendente e atrasado em reais e em centavos, e o mês aberto por categoria. preset: past12, next12 ou m24. Ou from e to em AAAA-MM. Use os totais; não some a lista.",
    inputSchema: expenseReportSchema,
  }, async (args) => gate("read", () => api.report({
    preset: args.from || args.to ? "custom" : parseChartPreset(args.preset),
    from: textOf(args.from),
    to: textOf(args.to),
  })));

  server.registerTool("finance_snapshot", {
    ...readMeta("Resumo financeiro"),
    description: "Como está o mês: saldo das contas, faturas dos cartões e totais de despesa (pago, pendente, atrasado). month opcional.",
    inputSchema: monthSchema,
  }, async (args) => gate("read", () => api.snapshot(parseMonthKey(args.month, todayYmd()))));

  server.registerTool("list_bills", {
    ...readMeta("Contas a pagar"),
    description: "Contas a pagar do mês, com vencimento e valor em reais. Inclui boleto, parcela e fatura. month opcional (AAAA-MM ou novembro).",
    inputSchema: monthSchema,
  }, async (args) => gate("read", () => api.bills(parseMonthKey(args.month, todayYmd()))));

  server.registerTool("list_finance_options", {
    ...readMeta("Contas, cartões e categorias"),
    description: "Contas com saldo, cartões e categorias de despesa. Chame antes de criar uma despesa para usar o nome certo.",
    inputSchema: z.object({}),
  }, async () => gate("read", () => api.options()));

  server.registerTool("list_recurring_expenses", {
    ...readMeta("Listar recorrentes"),
    description: "Despesas e receitas que se repetem: valor, dia, frequência, conta ou cartão, e se tem data para acabar. Assinatura sem end_date não acaba.",
    inputSchema: z.object({}),
  }, async () => gate("read", () => api.recurrences()));

  server.registerTool("list_loans", {
    ...readMeta("Listar empréstimos"),
    description: "Empréstimos: saldo em aberto, valor da parcela, parcelas restantes e atrasadas.",
    inputSchema: z.object({}),
  }, async () => gate("read", () => api.loans()));

  server.registerTool("finance_analytics", {
    ...readMeta("Visão para dashboard"),
    description: "Receitas, despesas e resultado por mês, saldo, faturas e empréstimos. Números prontos para um dashboard. from e to em AAAA-MM; se omitir, usa os últimos meses.",
    inputSchema: analyticsSchema,
  }, async (args) => gate("read", () => api.analytics({ from: textOf(args.from), to: textOf(args.to) })));

  server.registerTool("create_expense", {
    ...writeMeta("Criar despesa"),
    description: "Cria despesa avulsa na conta. amount em reais (89,90). date: hoje, dia 15 ou AAAA-MM-DD. account e category pelo nome. paid=true faz o dinheiro sair da conta. Para só marcar Pago na aba, sem debitar de novo, use pay_expense.",
    inputSchema: createExpenseSchema,
  }, async (args) => gate("write", () => api.createExpense({
    description: required(args.description, "a descrição"),
    amountCents: parseReais(args.amount),
    date: parseCivilDate(args.date, todayYmd()),
    account: textOf(args.account),
    category: textOf(args.category),
    paid: parseOptionalPaid(args.paid),
    notes: textOf(args.notes),
  })));

  server.registerTool("create_recurring_expense", {
    ...writeMeta("Criar despesa recorrente"),
    description: "Cria despesa que se repete. interval: mensal, bimestral, trimestral, semestral ou anual. O dia do vencimento sai de start_date. Sem end_date não acaba (assinatura, Netflix). Informe account ou card, não os dois.",
    inputSchema: createRecurringSchema,
  }, async (args) => gate("write", () => {
    const startDate = parseCivilDate(args.start_date, todayYmd());
    return api.createRecurring({
      description: required(args.description, "a descrição"),
      amountCents: parseReais(args.amount),
      account: textOf(args.account),
      card: textOf(args.card),
      category: textOf(args.category),
      startDate,
      intervalMonths: parseInterval(args.interval),
      dayOfMonth: dayOf(startDate),
      endDate: textOf(args.end_date) ? parseCivilDate(args.end_date) : undefined,
    });
  }));

  server.registerTool("create_card_expense", {
    ...writeMeta("Criar despesa no cartão"),
    description: "Compra no cartão, à vista ou parcelada. installments de 1 a 48. amount é o total em reais. Na aba Despesas o vencimento é o da fatura, não o dia da compra. Assinatura sem fim usa create_recurring_expense com card.",
    inputSchema: createCardSchema,
  }, async (args) => gate("write", () => api.createCard({
    description: required(args.description, "a descrição"),
    amountCents: parseReais(args.amount),
    card: required(args.card, "o cartão"),
    date: parseCivilDate(args.date, todayYmd()),
    installments: parseInstallments(args.installments),
    category: textOf(args.category),
    notes: textOf(args.notes),
  })));

  server.registerTool("create_housing_expense", {
    ...writeMeta("Criar aluguel ou condomínio"),
    description: "Cadastra aluguel ou condomínio como despesa mensal de moradia. system: aluguel ou condominio. Informe account ou card. O dia sai de start_date.",
    inputSchema: createHousingSchema,
  }, async (args) => gate("write", () => {
    const system = parseHousingSystem(args.system);
    return api.createHousing({
      system,
      description: textOf(args.description) || (system === "aluguel" ? "Aluguel" : "Condomínio"),
      amountCents: parseReais(args.amount),
      startDate: parseCivilDate(args.start_date, todayYmd()),
      account: textOf(args.account),
      card: textOf(args.card),
    });
  }));

  server.registerTool("update_expense", {
    ...writeMeta("Atualizar despesa", { idempotent: true }),
    description: "Atualiza descrição, valor em reais, data, categoria, conta ou notas. Informe id ou query. Não apaga a despesa.",
    inputSchema: updateExpenseSchema,
  }, async (args) => gate("write", () => {
    const patch: ExpensePatch = {
      description: textOf(args.description),
      amountCents: textOf(args.amount) ? parseReais(args.amount) : undefined,
      date: textOf(args.date) ? parseCivilDate(args.date) : undefined,
      category: textOf(args.category),
      account: textOf(args.account),
      notes: textOf(args.notes),
    };
    if (!patch.description && patch.amountCents == null && !patch.date && !patch.category && !patch.account && patch.notes == null) {
      throw new FinanceToolError("Nada para atualizar. Informe amount, date, description, category, account ou notes.");
    }
    return api.updateExpense(refOf(args), patch);
  }));

  server.registerTool("pay_expense", {
    ...writeMeta("Pagar despesa", { idempotent: true }),
    description: "Marca a despesa como Paga ou Não paga na aba Despesas. Não debita o saldo e não cria outro lançamento. Vale para conta e para cartão. paid=false desmarca. date opcional (padrão hoje).",
    inputSchema: payExpenseSchema,
  }, async (args) => gate("write", () => {
    const paid = parseOptionalPaid(args.paid);
    return api.payExpense(refOf(args), paid ?? true, parseCivilDate(args.date, todayYmd()));
  }));

  server.registerTool("delete_expense", {
    ...writeMeta("Apagar despesa", { destructive: true }),
    description: "Apaga a despesa. Exige confirm=true. scope: one (só esta), group (todas as parcelas) ou future (esta e as próximas da recorrência; a fatura atual da assinatura fica). Parcela de empréstimo não apaga por aqui.",
    inputSchema: deleteExpenseSchema,
  }, async (args) => gate("write", async () => {
    if (!confirmed(args.confirm)) {
      throw new FinanceToolError("Para apagar, envie confirm=true. scope=one apaga só esta; group apaga as parcelas; future apaga esta e as próximas.");
    }
    return api.deleteExpense(refOf(args), parseDeleteScope(args.scope));
  }));

  server.registerTool("create_income", {
    ...writeMeta("Criar receita"),
    description: "Lança uma receita na conta. amount em reais. paid=true entra no saldo agora. account e category pelo nome.",
    inputSchema: createExpenseSchema,
  }, async (args) => gate("write", () => api.createIncome({
    description: required(args.description, "a descrição"),
    amountCents: parseReais(args.amount),
    date: parseCivilDate(args.date, todayYmd()),
    account: textOf(args.account),
    category: textOf(args.category),
    paid: parseOptionalPaid(args.paid),
    notes: textOf(args.notes),
  })));

  server.registerTool("create_transfer", {
    ...writeMeta("Transferir entre contas"),
    description: "Transfere um valor de uma conta para outra. amount em reais. from_account e to_account pelo nome.",
    inputSchema: createTransferSchema,
  }, async (args) => gate("write", () => api.createTransfer({
    amountCents: parseReais(args.amount),
    date: parseCivilDate(args.date, todayYmd()),
    fromAccount: required(args.from_account, "a conta de origem"),
    toAccount: required(args.to_account, "a conta de destino"),
    description: textOf(args.description),
  })));

  server.registerTool("pay_card_invoice", {
    ...writeMeta("Pagar fatura"),
    description: "Paga a fatura do cartão: debita a conta e baixa a fatura. Isso é diferente de pay_expense, que só marca Pago na aba. card e account pelo nome. month AAAA-MM. amount em reais.",
    inputSchema: payInvoiceSchema,
  }, async (args) => gate("write", () => api.payInvoice({
    card: required(args.card, "o cartão"),
    month: parseMonthKey(args.month, todayYmd()),
    account: textOf(args.account),
    amountCents: parseReais(args.amount),
    date: parseCivilDate(args.date, todayYmd()),
  })));
}
