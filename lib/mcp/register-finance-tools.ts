import { addMonthsToKey, monthOf, todayYmd, type MonthKey } from "@/lib/finance/dates";
import { chartWindow } from "@/lib/finance/expenses";
import { formatBRL } from "@/lib/finance/money";
import {
  expenseDashboard,
  FinanceToolError,
  fold,
  intervalLabel,
  parseMonthKey,
  presentAnalytics,
  presentBill,
  presentExpense,
  presentLoan,
} from "@/lib/finance/mcp-logic";
import {
  createEntry,
  createHousingRecurrence,
  deleteTransaction,
  getAnalytics,
  getBills,
  getBootstrap,
  getExpenses,
  getTransaction,
  listLoans,
  listRecurrences,
  payInvoice,
  searchExpenses,
  updateTransaction,
} from "@/lib/finance/service";
import type { FinExpense } from "@/lib/finance/types";
import type { FinanceToolApi } from "@/lib/mcp/finance-tools";
import { bindFinanceTools } from "@/lib/mcp/finance-tools";
import type { ToolServer } from "@/lib/mcp/annotations";

type Named = { id: string; name: string };

function matchOne<T extends Named>(rows: T[], raw: string, label: string): T {
  const query = fold(raw);
  const byId = rows.find((row) => row.id === raw);
  if (byId) return byId;
  const exact = rows.filter((row) => fold(row.name) === query);
  const hits = exact.length ? exact : rows.filter((row) => fold(row.name).includes(query));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) {
    const options = rows.map((row) => row.name).slice(0, 12).join(", ");
    throw new FinanceToolError(`${label} não encontrado: ${raw}. Opções: ${options || "nenhuma"}`);
  }
  throw new FinanceToolError(
    `Há mais de um ${label.toLowerCase()} com "${raw}". Escolha pelo nome.`,
    hits.slice(0, 8).map((row) => ({ id: row.id, label: row.name }))
  );
}

async function catalog() {
  const data = await getBootstrap();
  return {
    accounts: data.accounts.filter((account) => !account.archived),
    cards: data.cards.filter((card) => !card.archived),
    categories: data.categories.filter((category) => !category.archived),
  };
}

async function accountId(raw: string | undefined, accounts: Named[]) {
  if (!raw) {
    if (accounts.length === 1) return accounts[0].id;
    throw new FinanceToolError(
      "Informe a conta.",
      accounts.map((account) => ({ id: account.id, label: account.name }))
    );
  }
  return matchOne(accounts, raw, "Conta").id;
}

function categoryId(raw: string | undefined, categories: Named[]) {
  if (!raw) return null;
  return matchOne(categories, raw, "Categoria").id;
}

async function resolveExpenseId(ref: { id?: string; query?: string }) {
  if (ref.id) return ref.id;
  const query = ref.query?.trim();
  if (!query) throw new FinanceToolError("Informe id ou query");
  const hits = await searchExpenses(query, 8);
  if (hits.length === 0) throw new FinanceToolError(`Não achei despesa com "${query}"`);
  if (hits.length > 1) {
    throw new FinanceToolError(
      "Mais de uma despesa. Escolha o id.",
      hits.map((hit) => ({
        id: hit.id,
        label: `${hit.description} · ${formatBRL(hit.amountCents)} · ${hit.date}${hit.clearedAt ? " · Paga" : ""}`,
      }))
    );
  }
  return hits[0].id;
}

async function showExpense(id: string) {
  const found = await getTransaction(id);
  const today = todayYmd();
  const months = [...new Set([found.transaction.invoiceMonth ?? monthOf(found.transaction.date), monthOf(today)])];
  const data = await catalog();
  const names = {
    category: new Map(data.categories.map((category) => [category.id, category.name])),
    account: new Map(data.accounts.map((account) => [account.id, account.name])),
    card: new Map(data.cards.map((card) => [card.id, card.name])),
  };
  for (const month of months) {
    const page = await getExpenses(month);
    const item = page.items.find((row) => row.id === id);
    if (item) return presentExpense(item, labelOf(item, names));
  }
  return {
    id,
    description: found.transaction.description,
    amount: formatBRL(found.transaction.amountCents),
    date: found.transaction.date,
    kind: found.transaction.kind,
    note: "Este lançamento não está na lista de despesas do mês.",
  };
}

function labelOf(
  item: FinExpense,
  names: { category: Map<string, string>; account: Map<string, string>; card: Map<string, string> }
) {
  return {
    category: item.categoryId ? names.category.get(item.categoryId) ?? null : null,
    account: item.accountId ? names.account.get(item.accountId) ?? null : null,
    card: item.cardId ? names.card.get(item.cardId) ?? null : null,
  };
}

function financeApi(): FinanceToolApi {
  return {
    async listExpenses({ month, status, q }) {
      const page = await getExpenses(month as MonthKey);
      const data = await catalog();
      const names = {
        category: new Map(data.categories.map((category) => [category.id, category.name])),
        account: new Map(data.accounts.map((account) => [account.id, account.name])),
        card: new Map(data.cards.map((card) => [card.id, card.name])),
      };
      const needle = q ? fold(q) : "";
      const items = page.items.filter((item) => {
        if (status !== "all" && item.status !== status) return false;
        if (!needle) return true;
        return fold(`${item.description} ${item.detail} ${item.notes}`).includes(needle);
      });
      return {
        ...expenseDashboard(page, names.category),
        filter: { status, q: q ?? null },
        shown: items.length,
        truncated: items.length > 60,
        items: items.slice(0, 60).map((item) => presentExpense(item, labelOf(item, names))),
      };
    },
    async getExpense(ref) {
      return showExpense(await resolveExpenseId(ref));
    },
    async searchExpenses(q, month) {
      const hits = await searchExpenses(q, 20);
      const rows = month
        ? hits.filter((hit) => hit.invoiceMonth === month || hit.date.startsWith(month))
        : hits;
      return {
        query: q,
        month: month ?? null,
        total: rows.length,
        exists: rows.length > 0,
        items: rows.map((hit) => ({
          id: hit.id,
          description: hit.description,
          amount: formatBRL(hit.amountCents),
          amount_cents: hit.amountCents,
          date: hit.date,
          invoice_month: hit.invoiceMonth,
          status_label: hit.clearedAt ? "Paga" : "Não paga na aba",
          category: hit.category,
          account: hit.account,
          card: hit.card,
          loan: Boolean(hit.loanId),
        })),
        note: rows.length
          ? "Se existir mais de uma, use o id em get_expense, pay_expense ou update_expense."
          : "Não achei despesa com esse texto.",
      };
    },
    async report({ preset, from, to }) {
      const today = todayYmd();
      const window = chartWindow(today, preset, { from, to });
      const page = await getExpenses(monthOf(today), window);
      const data = await catalog();
      return expenseDashboard(page, new Map(data.categories.map((category) => [category.id, category.name])));
    },
    async snapshot(month) {
      const [page, data] = await Promise.all([getExpenses(month as MonthKey), catalog()]);
      const dash = expenseDashboard(page, new Map(data.categories.map((category) => [category.id, category.name])));
      return {
        today: page.today,
        month,
        accounts: data.accounts.map((account) => ({
          name: account.name,
          balance: formatBRL(account.balanceCents),
          balance_cents: account.balanceCents,
        })),
        cards: data.cards.map((card) => ({
          name: card.name,
          open_invoice: formatBRL(card.openInvoice.openCents),
          open_cents: card.openInvoice.openCents,
          due_invoice: card.dueInvoice
            ? { month: card.dueInvoice.month, due_date: card.dueInvoice.dueDate, open: formatBRL(card.dueInvoice.openCents) }
            : null,
        })),
        expenses: dash.totals,
        by_category: dash.by_category,
        note: dash.note,
      };
    },
    async bills(month) {
      const page = await getBills(month as MonthKey);
      return {
        today: page.today,
        month: page.month,
        pending_total: formatBRL(page.totals.pendingCents),
        paid_total: formatBRL(page.totals.paidCents),
        overdue: formatBRL(page.totals.overdueCents),
        overdue_count: page.totals.overdueCount,
        pending_cents: page.totals.pendingCents,
        paid_cents: page.totals.paidCents,
        overdue_cents: page.totals.overdueCents,
        months: page.months.map((row) => ({
          month: row.month,
          pending: formatBRL(row.pendingCents),
          paid: formatBRL(row.paidCents),
          overdue: formatBRL(row.overdueCents),
          pending_cents: row.pendingCents,
          paid_cents: row.paidCents,
          overdue_cents: row.overdueCents,
        })),
        pending: page.pending.slice(0, 40).map(presentBill),
        paid: page.paid.slice(0, 20).map(presentBill),
        note: "Totais prontos. pending é o que ainda falta pagar neste mês.",
      };
    },
    async options() {
      const data = await catalog();
      return {
        accounts: data.accounts.map((account) => ({
          id: account.id,
          name: account.name,
          balance: formatBRL(account.balanceCents),
          balance_cents: account.balanceCents,
        })),
        cards: data.cards.map((card) => ({
          id: card.id,
          name: card.name,
          closing_day: card.closingDay,
          due_day: card.dueDay,
          open_invoice: formatBRL(card.openInvoice.openCents),
        })),
        expense_categories: data.categories
          .filter((category) => category.kind === "expense")
          .map((category) => ({ id: category.id, name: category.name })),
        income_categories: data.categories
          .filter((category) => category.kind === "income")
          .map((category) => ({ id: category.id, name: category.name })),
      };
    },
    async recurrences() {
      const [rules, data] = await Promise.all([listRecurrences(), catalog()]);
      const accounts = new Map(data.accounts.map((account) => [account.id, account.name]));
      const cards = new Map(data.cards.map((card) => [card.id, card.name]));
      return rules.map((rule) => ({
        id: rule.id,
        description: rule.description,
        kind: rule.kind === "income" ? "receita" : "despesa",
        amount: formatBRL(rule.amountCents),
        amount_cents: rule.amountCents,
        interval: intervalLabel(rule.intervalMonths),
        day: rule.dayOfMonth,
        start_date: rule.startDate,
        end_date: rule.endDate,
        open_ended: rule.endDate == null,
        account: rule.accountId ? accounts.get(rule.accountId) ?? null : null,
        card: rule.cardId ? cards.get(rule.cardId) ?? null : null,
        next_date: rule.nextDate,
      }));
    },
    async loans() {
      const rows = await listLoans();
      return {
        total_balance: formatBRL(rows.reduce((sum, loan) => sum + loan.balanceCents, 0)),
        loans: rows.map(presentLoan),
      };
    },
    async analytics({ from, to }) {
      const today = todayYmd();
      const end = to ? parseMonthKey(to, today) : monthOf(today);
      const start = from ? parseMonthKey(from, today) : addMonthsToKey(end, -5);
      return presentAnalytics(await getAnalytics(start, end));
    },
    async createExpense(input) {
      const data = await catalog();
      const account = await accountId(input.account, data.accounts);
      const created = await createEntry({
        mode: "one_off",
        kind: "expense",
        description: input.description,
        amountCents: input.amountCents,
        date: input.date,
        accountId: account,
        categoryId: categoryId(input.category, data.categories.filter((category) => category.kind === "expense")),
        notes: input.notes ?? "",
        ...(input.paid === undefined ? {} : { paid: input.paid }),
      });
      return {
        created: true,
        ...created,
        description: input.description,
        amount: formatBRL(input.amountCents),
        date: input.date,
        account: data.accounts.find((row) => row.id === account)?.name ?? account,
        note: "paid=true tira o valor do saldo. Para só marcar Pago na aba, use pay_expense.",
      };
    },
    async createRecurring(input) {
      if (input.account && input.card) throw new FinanceToolError("Escolha uma conta ou um cartão, não os dois.");
      const data = await catalog();
      const account = input.card ? undefined : await accountId(input.account, data.accounts);
      const card = input.card ? matchOne(data.cards, input.card, "Cartão").id : undefined;
      const created = await createEntry({
        mode: "recurring",
        kind: "expense",
        type: "fixed",
        description: input.description,
        amountCents: input.amountCents,
        accountId: account,
        cardId: card,
        intervalMonths: input.intervalMonths,
        dayOfMonth: input.dayOfMonth,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        categoryId: categoryId(input.category, data.categories.filter((category) => category.kind === "expense")),
        notes: "",
      });
      return {
        created: true,
        ...created,
        description: input.description,
        amount: formatBRL(input.amountCents),
        interval: intervalLabel(input.intervalMonths),
        day: input.dayOfMonth,
        end_date: input.endDate ?? null,
        note: input.endDate ? "Tem data para acabar." : "Sem data para acabar. Entra todo o período até você cancelar.",
      };
    },
    async createCard(input) {
      const data = await catalog();
      const card = matchOne(data.cards, input.card, "Cartão");
      const created = await createEntry({
        mode: "card",
        description: input.description,
        amountCents: input.amountCents,
        date: input.date,
        cardId: card.id,
        installments: input.installments,
        categoryId: categoryId(input.category, data.categories.filter((category) => category.kind === "expense")),
        notes: input.notes ?? "",
      });
      return {
        created: true,
        ...created,
        description: input.description,
        amount: formatBRL(input.amountCents),
        card: card.name,
        installments: input.installments,
        note: "Na aba Despesas o vencimento é o da fatura. Marcar Pago não debita a conta: isso acontece ao pagar a fatura.",
      };
    },
    async createHousing(input) {
      if (Boolean(input.account) === Boolean(input.card)) {
        throw new FinanceToolError("Escolha uma conta ou um cartão.");
      }
      const data = await catalog();
      const created = await createHousingRecurrence({
        system: input.system,
        description: input.description,
        amountCents: input.amountCents,
        startDate: input.startDate,
        accountId: input.account ? await accountId(input.account, data.accounts) : undefined,
        cardId: input.card ? matchOne(data.cards, input.card, "Cartão").id : undefined,
      });
      return {
        created: true,
        ...created,
        description: input.description,
        amount: formatBRL(input.amountCents),
        system: input.system,
      };
    },
    async updateExpense(ref, patch) {
      const id = await resolveExpenseId(ref);
      const data = await catalog();
      await updateTransaction(id, {
        ...(patch.description ? { description: patch.description } : {}),
        ...(patch.amountCents != null ? { amountCents: patch.amountCents } : {}),
        ...(patch.date ? { date: patch.date } : {}),
        ...(patch.notes != null ? { notes: patch.notes } : {}),
        ...(patch.account ? { accountId: await accountId(patch.account, data.accounts) } : {}),
        ...(patch.category
          ? { categoryId: categoryId(patch.category, data.categories.filter((category) => category.kind === "expense")) }
          : {}),
      });
      return showExpense(id);
    },
    async payExpense(ref, paid, date) {
      const id = await resolveExpenseId(ref);
      await updateTransaction(id, { clearedAt: paid ? date : null });
      const item = await showExpense(id);
      return {
        ...item,
        note: paid
          ? "Marcada como Paga na aba Despesas. O saldo da conta não mudou."
          : "Marcada como não paga. O saldo da conta não mudou.",
      };
    },
    async deleteExpense(ref, scope) {
      const id = await resolveExpenseId(ref);
      await deleteTransaction(id, scope);
      return { deleted: true, id, scope };
    },
    async createIncome(input) {
      const data = await catalog();
      const account = await accountId(input.account, data.accounts);
      const created = await createEntry({
        mode: "one_off",
        kind: "income",
        description: input.description,
        amountCents: input.amountCents,
        date: input.date,
        accountId: account,
        categoryId: categoryId(input.category, data.categories.filter((category) => category.kind === "income")),
        notes: input.notes ?? "",
        ...(input.paid === undefined ? {} : { paid: input.paid }),
      });
      return {
        created: true,
        ...created,
        description: input.description,
        amount: formatBRL(input.amountCents),
        date: input.date,
      };
    },
    async createTransfer(input) {
      const data = await catalog();
      const from = await accountId(input.fromAccount, data.accounts);
      const to = await accountId(input.toAccount, data.accounts);
      const created = await createEntry({
        mode: "transfer",
        amountCents: input.amountCents,
        date: input.date,
        accountId: from,
        toAccountId: to,
        description: input.description,
      });
      return { created: true, ...created, amount: formatBRL(input.amountCents), date: input.date };
    },
    async payInvoice(input) {
      const data = await catalog();
      const card = matchOne(data.cards, input.card, "Cartão");
      const account = await accountId(input.account, data.accounts);
      await payInvoice(card.id, input.month as MonthKey, {
        accountId: account,
        amountCents: input.amountCents,
        date: input.date,
      });
      return {
        paid: true,
        card: card.name,
        month: input.month,
        amount: formatBRL(input.amountCents),
        date: input.date,
        note: "A fatura foi baixada e o valor saiu da conta.",
      };
    },
  };
}

export function registerFinanceTools(server: ToolServer, ctx: { scopes: string[] }) {
  bindFinanceTools(server, ctx, financeApi());
}
