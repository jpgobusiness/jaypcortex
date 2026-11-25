// Regras de negócio das finanças (servidor). As rotas em app/api/financas validam e chamam isto.
import { randomUUID } from "node:crypto";
import {
  Prisma,
  type CreditCard,
  type FinanceCategory,
  type FinanceRecurrence,
  type FinanceTransaction,
  type Loan,
} from "@/app/generated/prisma-postgres/client";
import { prisma } from "@/lib/prisma";
import { natureOf } from "./analytics";
import { billStatus, billsForMonth, monthsAhead } from "./bills";
import { expenseMonths, expenseStatus, expensesForMonth } from "./expenses";
import { EXPENSE_HISTORY_MONTHS, type TransactionKind } from "./constants";
import {
  addDaysYmd,
  addMonthsToKey,
  addMonthsYmd,
  dayInMonth,
  monthOf,
  monthRange,
  parseYmd,
  shortMonth,
  toDateUtc,
  todayYmd,
  toYmd,
  type MonthKey,
  type Ymd,
} from "./dates";
import { planCardInstallments, purchaseDateOf, purchaseTotalFromSiblings } from "./installments";
import { invoiceDates, invoiceMonthFor, summarizeInvoices, type CardDays } from "./invoice";
import { annualRate, buildSchedule, effectiveCost, impliedMonthlyRate, payoffQuotes, payoffToday, pricePayment } from "./loan";
import { splitInstallments } from "./money";
import { housingHorizon, housingMonths, housingSystemOf } from "./housing";
import { cancelRecurrenceCutoff, monthlyEquivalent, occurrences, RECURRENCE_HORIZON_MONTHS } from "./recurrence";
import { DASHBOARD_TEMPLATES, templateWidgets } from "./templates";
import type {
  AgendaItem,
  BalancePoint,
  FactRow,
  FinAccount,
  FinAnalytics,
  FinBill,
  FinBills,
  FinBootstrap,
  FinCard,
  FinCategory,
  FinDashboard,
  FinExpense,
  FinExpenses,
  FinInvoice,
  FinInvoiceDetail,
  FinLoan,
  FinLoanDetail,
  FinRecurrence,
  FinRecurrenceDetail,
  FinTransaction,
  FlowKind,
  TransactionStatus,
  WidgetConfig,
} from "./types";
import {
  FinanceError,
  type EntryInput,
  type HousingRecurrenceInput,
  type LoanInput,
  type LoanSettleInput,
  type accountInput,
  type accountPatch,
  type cardInput,
  type cardPatch,
  type categoryInput,
  type categoryPatch,
  type dashboardInput,
  type dashboardPatch,
  type invoicePatch,
  type invoicePayment,
  type recurrencePatch,
  type transactionPatch,
} from "./validation";
import type { z } from "zod";

type Db = typeof prisma | Prisma.TransactionClient;

const day = (value: Ymd) => toDateUtc(value);
const optionalDay = (value: Date | null) => (value ? toYmd(value) : null);
/** numeric (reais) das views → centavos. */
const reais = (value: unknown) => Math.round(Number(value ?? 0) * 100);
const monthEnd = (month: MonthKey) => dayInMonth(month, 31);
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// ---------------------------------------------------------------- conversões

function toCategory(row: FinanceCategory): FinCategory {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as FlowKind,
    icon: row.icon,
    color: row.color,
    parentId: row.parentId,
    essential: row.essential,
    system: row.system,
    archived: row.archived,
    order: row.order,
  };
}

const txInclude = { recurrence: { select: { type: true } } } satisfies Prisma.FinanceTransactionInclude;
type TxRow = FinanceTransaction & { recurrence?: { type: string } | null };

function toTransaction(row: TxRow, today: Ymd): FinTransaction {
  const date = toYmd(row.date);
  const paidAt = optionalDay(row.paidAt);
  const flow = row.kind === "income" || row.kind === "expense";
  let status: TransactionStatus = "paid";
  if (row.cardId && row.kind === "expense") status = "card";
  else if (!paidAt) status = flow ? (date < today ? "overdue" : "pending") : "pending";
  return {
    id: row.id,
    kind: row.kind as TransactionKind,
    description: row.description,
    amountCents: row.amountCents,
    date,
    paidAt,
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    cardId: row.cardId,
    invoiceMonth: row.invoiceMonth,
    categoryId: row.categoryId,
    recurrenceId: row.recurrenceId,
    recurrenceKey: row.recurrenceKey,
    installmentGroupId: row.installmentGroupId,
    installmentNumber: row.installmentNumber,
    installmentCount: row.installmentCount,
    loanId: row.loanId,
    interestCents: row.interestCents,
    tags: row.tags,
    notes: row.notes,
    nature: natureOf({
      kind: row.kind,
      loanId: row.loanId,
      installmentGroupId: row.installmentGroupId,
      recurrenceId: row.recurrenceId,
      recurrenceType: row.recurrence?.type ?? null,
    }),
    status,
  };
}

function toFact(row: TxRow, today: Ymd): FactRow {
  const date = toYmd(row.date);
  const card = Boolean(row.cardId);
  return {
    id: row.id,
    kind: row.kind as FlowKind,
    month: card && row.invoiceMonth ? row.invoiceMonth : monthOf(date),
    date,
    amountCents: row.amountCents,
    realized: card ? date <= today : row.paidAt !== null,
    categoryId: row.categoryId,
    accountId: row.accountId,
    cardId: row.cardId,
    nature:
      natureOf({
        kind: row.kind,
        loanId: row.loanId,
        installmentGroupId: row.installmentGroupId,
        recurrenceId: row.recurrenceId,
        recurrenceType: row.recurrence?.type ?? null,
      }) ?? "one_off",
    description: row.description,
    tags: row.tags,
    interestCents: row.interestCents ?? 0,
    loanId: row.loanId,
  };
}

// ---------------------------------------------------------------- checagens

async function assertAccount(id: string, db: Db = prisma) {
  const account = await db.financeAccount.findUnique({ where: { id }, select: { id: true } });
  if (!account) throw new FinanceError("Escolha uma conta válida");
}

async function cardRow(id: string, db: Db = prisma) {
  const card = await db.creditCard.findUnique({ where: { id } });
  if (!card) throw new FinanceError("Cartão não encontrado", 404);
  return card;
}

async function assertCategory(id: string | null | undefined, kind: string) {
  if (!id) return;
  const category = await prisma.financeCategory.findUnique({ where: { id }, select: { kind: true } });
  if (!category || (kind !== "income" && kind !== "expense") || category.kind !== kind) {
    throw new FinanceError(kind === "income" ? "Escolha uma categoria de receita" : "Escolha uma categoria de despesa");
  }
}

// ---------------------------------------------------------------- categorias

export async function listCategories(): Promise<FinCategory[]> {
  const rows = await prisma.financeCategory.findMany({ orderBy: [{ kind: "asc" }, { order: "asc" }, { name: "asc" }] });
  return rows.map(toCategory);
}

export async function createCategory(input: z.infer<typeof categoryInput>) {
  if (input.parentId) {
    const parent = await prisma.financeCategory.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.kind !== input.kind) throw new FinanceError("A categoria-mãe precisa ser do mesmo tipo");
    if (parent.parentId) throw new FinanceError("Subcategoria só tem um nível");
  }
  const order = await prisma.financeCategory.count({ where: { kind: input.kind } });
  const row = await prisma.financeCategory.create({
    data: {
      name: input.name,
      kind: input.kind,
      icon: input.icon ?? "tag",
      color: input.color ?? "#94a3b8",
      parentId: input.parentId ?? null,
      essential: input.essential ?? false,
      order: order + 1,
    },
  });
  return toCategory(row);
}

export async function updateCategory(id: string, patch: z.infer<typeof categoryPatch>) {
  const current = await prisma.financeCategory.findUnique({ where: { id } });
  if (!current) throw new FinanceError("Categoria não encontrada", 404);
  if (patch.parentId) {
    const parent = await prisma.financeCategory.findUnique({ where: { id: patch.parentId } });
    if (!parent || parent.kind !== current.kind || parent.parentId || parent.id === id) throw new FinanceError("Categoria-mãe inválida");
  }
  return toCategory(await prisma.financeCategory.update({ where: { id }, data: patch }));
}

export async function deleteCategory(id: string) {
  const current = await prisma.financeCategory.findUnique({ where: { id } });
  if (!current) throw new FinanceError("Categoria não encontrada", 404);
  if (current.system) throw new FinanceError("Categoria padrão não pode ser excluída. Arquive para esconder.");
  await prisma.financeCategory.delete({ where: { id } });
}

// ---------------------------------------------------------------- contas

async function balances() {
  const rows = await prisma.$queryRaw<{ conta_id: string; saldo_atual: unknown; a_receber: unknown; a_pagar: unknown }[]>`
    SELECT conta_id, saldo_atual, a_receber, a_pagar FROM public.v_fin_contas`;
  return new Map(rows.map((row) => [row.conta_id, row]));
}

export async function listAccounts(): Promise<FinAccount[]> {
  const [rows, map] = await Promise.all([
    prisma.financeAccount.findMany({ orderBy: [{ archived: "asc" }, { order: "asc" }, { createdAt: "asc" }] }),
    balances(),
  ]);
  return rows.map((row) => {
    const balance = map.get(row.id);
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      institution: row.institution,
      color: row.color,
      initialBalanceCents: row.initialBalanceCents,
      initialBalanceDate: toYmd(row.initialBalanceDate),
      includeInTotals: row.includeInTotals,
      archived: row.archived,
      order: row.order,
      balanceCents: balance ? reais(balance.saldo_atual) : row.initialBalanceCents,
      pendingInCents: reais(balance?.a_receber),
      pendingOutCents: reais(balance?.a_pagar),
    };
  });
}

export async function createAccount(input: z.infer<typeof accountInput>) {
  const order = await prisma.financeAccount.count();
  const row = await prisma.financeAccount.create({
    data: {
      name: input.name,
      type: input.type ?? "checking",
      institution: input.institution ?? "",
      color: input.color ?? "#7b68ee",
      initialBalanceCents: input.initialBalanceCents ?? 0,
      initialBalanceDate: day(input.initialBalanceDate ?? todayYmd()),
      includeInTotals: input.includeInTotals ?? true,
      order,
    },
  });
  return { id: row.id };
}

export async function updateAccount(id: string, patch: z.infer<typeof accountPatch>) {
  const current = await prisma.financeAccount.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw new FinanceError("Conta não encontrada", 404);
  const { balanceCents, initialBalanceDate, ...rest } = patch;
  await prisma.financeAccount.update({
    where: { id },
    data: { ...rest, ...(initialBalanceDate ? { initialBalanceDate: day(initialBalanceDate) } : {}) },
  });
  if (balanceCents !== undefined) {
    // Ajustar saldo: lança a diferença para a conta bater com o banco hoje.
    const delta = balanceCents - reais((await balances()).get(id)?.saldo_atual);
    if (delta !== 0) {
      const today = day(todayYmd());
      await prisma.financeTransaction.create({
        data: { kind: "adjustment", description: "Ajuste de saldo", amountCents: delta, date: today, paidAt: today, accountId: id },
      });
    }
  }
}

export async function deleteAccount(id: string) {
  const used = await prisma.financeTransaction.count({ where: { OR: [{ accountId: id }, { toAccountId: id }] } });
  if (used > 0) {
    throw new FinanceError(`Esta conta tem ${plural(used, "lançamento", "lançamentos")}. Arquive para esconder sem perder o histórico.`, 409);
  }
  await prisma.financeAccount.delete({ where: { id } });
}

// ---------------------------------------------------------------- cartões e faturas

async function invoiceData(cardIds: string[]) {
  const [movements, overrides] = await Promise.all([
    prisma.financeTransaction.groupBy({
      by: ["cardId", "invoiceMonth", "kind"],
      where: { cardId: { in: cardIds }, invoiceMonth: { not: null }, kind: { in: ["expense", "card_payment"] } },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.cardInvoice.findMany({ where: { cardId: { in: cardIds } } }),
  ]);
  return { movements, overrides };
}

function invoicesFor(card: CreditCard, data: Awaited<ReturnType<typeof invoiceData>>, today: Ymd, extraMonth?: MonthKey) {
  const movements = data.movements
    .filter((row) => row.cardId === card.id && row.invoiceMonth)
    .map((row) => ({ month: row.invoiceMonth as string, kind: row.kind, cents: row._sum.amountCents ?? 0, count: row._count._all }));
  if (extraMonth) movements.push({ month: extraMonth, kind: "expense", cents: 0, count: 0 });
  return summarizeInvoices({
    card: { id: card.id, closingDay: card.closingDay, dueDay: card.dueDay },
    movements,
    overrides: data.overrides
      .filter((row) => row.cardId === card.id)
      .map((row) => ({ month: row.month, closingDate: optionalDay(row.closingDate), dueDate: optionalDay(row.dueDate), notes: row.notes })),
    today,
  });
}

function toCard(card: CreditCard, invoices: FinInvoice[], today: Ymd): FinCard {
  const charged = invoices.reduce((sum, invoice) => sum + invoice.totalCents, 0);
  const paid = invoices.reduce((sum, invoice) => sum + invoice.paidCents, 0);
  const used = Math.max(0, charged - paid);
  const openMonth = invoiceMonthFor(today, card);
  return {
    id: card.id,
    name: card.name,
    brand: card.brand,
    last4: card.last4,
    color: card.color,
    limitCents: card.limitCents,
    closingDay: card.closingDay,
    dueDay: card.dueDay,
    paymentAccountId: card.paymentAccountId,
    archived: card.archived,
    order: card.order,
    usedCents: used,
    availableCents: card.limitCents - used,
    openInvoice: invoices.find((invoice) => invoice.month === openMonth) ?? invoices[invoices.length - 1],
    dueInvoice: invoices.find((invoice) => (invoice.status === "closed" || invoice.status === "overdue") && invoice.openCents > 0) ?? null,
  };
}

async function cardsWithInvoices(today: Ymd) {
  const cards = await prisma.creditCard.findMany({ orderBy: [{ archived: "asc" }, { order: "asc" }, { createdAt: "asc" }] });
  if (cards.length === 0) return [];
  const data = await invoiceData(cards.map((card) => card.id));
  return cards.map((card) => {
    const invoices = invoicesFor(card, data, today);
    return { card: toCard(card, invoices, today), invoices };
  });
}

export async function listCards(today = todayYmd()): Promise<FinCard[]> {
  return (await cardsWithInvoices(today)).map((item) => item.card);
}

export async function getCard(id: string) {
  const today = todayYmd();
  const card = await cardRow(id);
  const invoices = invoicesFor(card, await invoiceData([id]), today);
  return { card: toCard(card, invoices, today), invoices };
}

async function assertPaymentAccount(id: string | null | undefined) {
  if (id) await assertAccount(id);
}

export async function createCard(input: z.infer<typeof cardInput>) {
  await assertPaymentAccount(input.paymentAccountId);
  const order = await prisma.creditCard.count();
  const row = await prisma.creditCard.create({
    data: {
      name: input.name,
      brand: input.brand ?? "other",
      last4: input.last4 ?? null,
      color: input.color ?? "#15171c",
      limitCents: input.limitCents,
      closingDay: input.closingDay,
      dueDay: input.dueDay,
      paymentAccountId: input.paymentAccountId ?? null,
      order,
    },
  });
  return { id: row.id };
}

export async function updateCard(id: string, patch: z.infer<typeof cardPatch>) {
  await cardRow(id);
  await assertPaymentAccount(patch.paymentAccountId);
  await prisma.creditCard.update({ where: { id }, data: patch });
}

export async function deleteCard(id: string) {
  const used = await prisma.financeTransaction.count({ where: { cardId: id } });
  if (used > 0) {
    throw new FinanceError(`Este cartão tem ${plural(used, "lançamento", "lançamentos")}. Arquive para esconder sem perder o histórico.`, 409);
  }
  await prisma.creditCard.delete({ where: { id } });
}

export async function getInvoice(cardId: string, month: MonthKey): Promise<FinInvoiceDetail> {
  const today = todayYmd();
  const card = await cardRow(cardId);
  const [data, rows] = await Promise.all([
    invoiceData([cardId]),
    prisma.financeTransaction.findMany({
      where: { cardId, invoiceMonth: month },
      include: txInclude,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const summary = invoicesFor(card, data, today, month).find((invoice) => invoice.month === month);
  if (!summary) throw new FinanceError("Fatura não encontrada", 404);
  const list = rows.map((row) => toTransaction(row, today));
  return { ...summary, charges: list.filter((item) => item.kind === "expense"), payments: list.filter((item) => item.kind === "card_payment") };
}

export async function updateInvoice(cardId: string, month: MonthKey, patch: z.infer<typeof invoicePatch>) {
  await cardRow(cardId);
  const data = {
    ...(patch.closingDate !== undefined ? { closingDate: patch.closingDate ? day(patch.closingDate) : null } : {}),
    ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate ? day(patch.dueDate) : null } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
  };
  await prisma.cardInvoice.upsert({ where: { cardId_month: { cardId, month } }, create: { cardId, month, ...data }, update: data });
}

export async function payInvoice(cardId: string, month: MonthKey, input: z.infer<typeof invoicePayment>) {
  const card = await cardRow(cardId);
  await assertAccount(input.accountId);
  const row = await prisma.financeTransaction.create({
    data: {
      kind: "card_payment",
      description: `Fatura ${card.name} · ${shortMonth(month)}`,
      amountCents: input.amountCents,
      date: day(input.date),
      paidAt: day(input.date),
      accountId: input.accountId,
      cardId,
      invoiceMonth: month,
    },
  });
  return { id: row.id };
}

// ---------------------------------------------------------------- recorrências

async function generateOccurrences(
  db: Db,
  rule: FinanceRecurrence,
  card: CardDays | null,
  today: Ymd,
  options?: { amounts?: Map<string, number>; fromStart?: boolean }
) {
  const horizon = addMonthsToKey(monthOf(today), RECURRENCE_HORIZON_MONTHS);
  if (!rule.accountId && !rule.cardId) return [];
  const list = occurrences(
    { startDate: toYmd(rule.startDate), endDate: optionalDay(rule.endDate), intervalMonths: rule.intervalMonths, dayOfMonth: rule.dayOfMonth },
    options?.fromStart ? null : rule.generatedUntil,
    horizon
  );
  let created: { id: string }[] = [];
  if (list.length > 0) {
    created = await db.financeTransaction.createManyAndReturn({
      data: list.map((item) => ({
        kind: rule.kind,
        description: rule.description,
        amountCents: options?.amounts?.get(item.key) ?? rule.amountCents,
        date: day(item.date),
        accountId: rule.cardId ? null : rule.accountId,
        cardId: rule.cardId,
        invoiceMonth: rule.cardId && card ? invoiceMonthFor(item.date, card) : null,
        categoryId: rule.categoryId,
        recurrenceId: rule.id,
        recurrenceKey: item.key,
        tags: rule.tags,
      })),
      skipDuplicates: true,
      select: { id: true },
    });
  }
  await db.financeRecurrence.update({ where: { id: rule.id }, data: { generatedUntil: horizon } });
  return created.map((item) => item.id);
}

async function applyRecurrenceMonths(
  db: Db,
  rule: FinanceRecurrence,
  months: { key: MonthKey; amountCents: number }[],
  today: Ymd
) {
  const amounts = new Map(months.map((item) => [item.key, item.amountCents]));
  const planned = housingMonths({
    startDate: toYmd(rule.startDate),
    dayOfMonth: rule.dayOfMonth,
    untilKey: housingHorizon(today),
    forecastCents: rule.amountCents,
    amounts,
  });
  if (planned.length === 0) return;
  const amountValues = Prisma.join(planned.map((item) => Prisma.sql`(${item.key}, ${item.amountCents}::int)`));
  const dateValues = Prisma.join(planned.map((item) => Prisma.sql`(${item.key}, ${item.date}::date)`));
  await db.$executeRaw`
    UPDATE "FinanceTransaction" AS t
    SET "amountCents" = v.amount
    FROM (VALUES ${amountValues}) AS v(key, amount)
    WHERE t."recurrenceId" = ${rule.id} AND t."recurrenceKey" = v.key
  `;
  await db.$executeRaw`
    UPDATE "FinanceTransaction" AS t
    SET "date" = v.d
    FROM (VALUES ${dateValues}) AS v(key, d)
    WHERE t."recurrenceId" = ${rule.id} AND t."recurrenceKey" = v.key AND t."paidAt" IS NULL
  `;
}

let syncedHorizon: MonthKey | null = null;

/** Garante os lançamentos das recorrências até o horizonte (12 meses à frente). */
export async function syncRecurrences(today = todayYmd()) {
  const horizon = addMonthsToKey(monthOf(today), RECURRENCE_HORIZON_MONTHS);
  if (syncedHorizon === horizon) return;
  const rules = await prisma.financeRecurrence.findMany({
    where: { active: true, OR: [{ generatedUntil: null }, { generatedUntil: { lt: horizon } }] },
    include: { card: { select: { closingDay: true, dueDay: true } } },
  });
  for (const rule of rules) await generateOccurrences(prisma, rule, rule.card, today);
  syncedHorizon = horizon;
}

type RecurrenceRow = FinanceRecurrence & { category: { system: string | null } | null };

function toRecurrence(
  rule: RecurrenceRow,
  today: Ymd,
  paidCount: number,
  upcoming?: { _count: { _all: number }; _min: { date: Date | null } }
): FinRecurrence {
  const endDate = optionalDay(rule.endDate);
  return {
    id: rule.id,
    kind: rule.kind as FlowKind,
    type: rule.type as "fixed" | "variable",
    description: rule.description,
    amountCents: rule.amountCents,
    categoryId: rule.categoryId,
    accountId: rule.accountId,
    cardId: rule.cardId,
    intervalMonths: rule.intervalMonths,
    dayOfMonth: rule.dayOfMonth,
    startDate: toYmd(rule.startDate),
    endDate,
    tags: rule.tags,
    notes: rule.notes,
    monthlyCents: monthlyEquivalent(rule.amountCents, rule.intervalMonths),
    nextDate: upcoming?._min.date ? toYmd(upcoming._min.date) : null,
    pendingCount: upcoming?._count._all ?? 0,
    paidCount,
    ended: endDate !== null && endDate < today,
    housing: housingSystemOf(rule.category?.system, rule.description) !== null,
  };
}

export async function listRecurrences(): Promise<FinRecurrence[]> {
  const today = todayYmd();
  await syncRecurrences(today);
  const [rules, paid, upcoming] = await Promise.all([
    prisma.financeRecurrence.findMany({
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      include: { category: { select: { system: true } } },
    }),
    prisma.financeTransaction.groupBy({
      by: ["recurrenceId"],
      where: { recurrenceId: { not: null }, OR: [{ paidAt: { not: null } }, { cardId: { not: null }, date: { lte: day(today) } }] },
      _count: { _all: true },
    }),
    prisma.financeTransaction.groupBy({
      by: ["recurrenceId"],
      where: { recurrenceId: { not: null }, paidAt: null, date: { gte: day(today) } },
      _count: { _all: true },
      _min: { date: true },
    }),
  ]);
  const paidMap = new Map(paid.map((row) => [row.recurrenceId, row._count._all]));
  const upcomingMap = new Map(upcoming.map((row) => [row.recurrenceId, row]));
  return rules.map((rule) => toRecurrence(rule, today, paidMap.get(rule.id) ?? 0, upcomingMap.get(rule.id)));
}

export async function getRecurrence(id: string): Promise<FinRecurrenceDetail> {
  const today = todayYmd();
  await syncRecurrences(today);
  const rule = await prisma.financeRecurrence.findUnique({
    where: { id },
    include: { category: { select: { system: true } } },
  });
  if (!rule) throw new FinanceError("Recorrência não encontrada", 404);
  const txs = await prisma.financeTransaction.findMany({
    where: { recurrenceId: id },
    orderBy: { recurrenceKey: "asc" },
  });
  const current = monthOf(today);
  const paidCount = txs.filter((row) => row.paidAt || (row.cardId && toYmd(row.date) <= today)).length;
  const upcoming = txs.filter((row) => !row.paidAt && toYmd(row.date) >= today);
  return {
    ...toRecurrence(
      rule,
      today,
      paidCount,
      upcoming.length > 0 ? { _count: { _all: upcoming.length }, _min: { date: upcoming[0].date } } : undefined
    ),
    months: txs
      .filter((row) => row.recurrenceKey)
      .map((row) => {
        const key = row.recurrenceKey as MonthKey;
        return {
          key,
          date: toYmd(row.date),
          amountCents: row.amountCents,
          transactionId: row.id,
          paidAt: optionalDay(row.paidAt),
          period: (key < current ? "past" : key === current ? "current" : "future") as FinRecurrenceDetail["months"][number]["period"],
        };
      }),
  };
}

export async function createHousingRecurrence(input: HousingRecurrenceInput): Promise<{ id: string }> {
  const today = todayYmd();
  if (Boolean(input.accountId) === Boolean(input.cardId)) throw new FinanceError("Escolha uma conta ou um cartão");
  if (input.accountId) await assertAccount(input.accountId);
  const card = input.cardId ? await cardRow(input.cardId) : null;
  const category = await prisma.financeCategory.findUnique({ where: { system: input.system } });
  if (!category) throw new FinanceError("Categoria de moradia não encontrada");
  const amounts = new Map((input.months ?? []).map((item) => [item.key, item.amountCents]));
  const id = await prisma.$transaction(async (tx) => {
    const rule = await tx.financeRecurrence.create({
      data: {
        kind: "expense",
        type: "fixed",
        description: input.description,
        amountCents: input.amountCents,
        categoryId: category.id,
        accountId: input.accountId ?? null,
        cardId: input.cardId ?? null,
        intervalMonths: 1,
        dayOfMonth: parseYmd(input.startDate).d,
        startDate: day(input.startDate),
        tags: [],
        notes: "",
      },
    });
    await generateOccurrences(tx, rule, card, today, { amounts, fromStart: true });
    return rule.id;
  }, { timeout: 20000 });
  syncedHorizon = null;
  return { id };
}

export async function updateRecurrence(id: string, patch: z.infer<typeof recurrencePatch>) {
  const today = todayYmd();
  const rule = await prisma.financeRecurrence.findUnique({ where: { id } });
  if (!rule) throw new FinanceError("Recorrência não encontrada", 404);
  if (patch.accountId && patch.cardId) throw new FinanceError("Escolha uma conta ou um cartão");
  if (patch.cardId && rule.kind === "income") throw new FinanceError("Receita entra numa conta, não num cartão");
  if (patch.accountId) await assertAccount(patch.accountId);
  if (patch.cardId) await cardRow(patch.cardId);
  if (patch.categoryId !== undefined) await assertCategory(patch.categoryId, rule.kind);
  const currentStart = toYmd(rule.startDate);
  const nextStart = patch.startDate ?? currentStart;
  const savingMonths = Boolean(patch.months);
  if (patch.endDate && patch.endDate < nextStart) throw new FinanceError("A data final precisa ser depois do início");
  if (patch.startDate && patch.startDate !== currentStart) {
    if (savingMonths && patch.startDate > currentStart) {
      const paidBefore = await prisma.financeTransaction.count({
        where: { recurrenceId: id, paidAt: { not: null }, recurrenceKey: { lt: monthOf(patch.startDate) } },
      });
      if (paidBefore > 0) throw new FinanceError("Há meses já pagos antes do novo início. Deixe a data como está ou apague o histórico.");
    } else if (!savingMonths) {
      const paid = await prisma.financeTransaction.count({ where: { recurrenceId: id, paidAt: { not: null } } });
      if (paid > 0) throw new FinanceError("Não dá para mudar o início depois que já houve pagamento. Encerre e crie de novo.");
    }
  }

  const data: Prisma.FinanceRecurrenceUncheckedUpdateInput = {
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.amountCents !== undefined ? { amountCents: patch.amountCents } : {}),
    ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
    ...(patch.accountId ? { accountId: patch.accountId, cardId: null } : {}),
    ...(patch.cardId ? { cardId: patch.cardId, accountId: null } : {}),
    ...(patch.intervalMonths !== undefined ? { intervalMonths: patch.intervalMonths } : {}),
    ...(patch.startDate ? { startDate: day(patch.startDate) } : {}),
    ...(patch.endDate !== undefined ? { endDate: patch.endDate ? day(patch.endDate) : null } : {}),
    ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
  };
  if (patch.dayOfMonth !== undefined) {
    data.dayOfMonth = patch.dayOfMonth;
    // Se ainda não começou, o primeiro lançamento também muda de dia.
    if (nextStart >= today) data.startDate = day(dayInMonth(monthOf(nextStart), patch.dayOfMonth));
  } else if (patch.startDate) {
    data.dayOfMonth = parseYmd(patch.startDate).d;
  }

  await prisma.$transaction(async (tx) => {
    await tx.financeRecurrence.update({ where: { id }, data });
    if (savingMonths) {
      if (patch.startDate && patch.startDate > currentStart) {
        await tx.financeTransaction.deleteMany({
          where: { recurrenceId: id, paidAt: null, recurrenceKey: { lt: monthOf(patch.startDate) } },
        });
      }
      const reset = await tx.financeRecurrence.findUniqueOrThrow({ where: { id } });
      await tx.financeTransaction.updateMany({
        where: { recurrenceId: id },
        data: { description: reset.description, categoryId: reset.categoryId, tags: reset.tags },
      });
      await tx.financeTransaction.updateMany({
        where: { recurrenceId: id, paidAt: null },
        data: reset.cardId ? { cardId: reset.cardId, accountId: null } : { accountId: reset.accountId, cardId: null },
      });
      const amounts = new Map((patch.months ?? []).map((item) => [item.key, item.amountCents]));
      const card = reset.cardId ? await tx.creditCard.findUnique({ where: { id: reset.cardId } }) : null;
      await generateOccurrences(tx, reset, card, today, { amounts, fromStart: true });
      await applyRecurrenceMonths(tx, reset, patch.months ?? [], today);
      return;
    }
    // Refaz os lançamentos ainda não pagos, de hoje em diante, com a regra nova.
    await tx.financeTransaction.deleteMany({ where: { recurrenceId: id, paidAt: null, date: { gte: day(today) } } });
    const last = await tx.financeTransaction.findFirst({
      where: { recurrenceId: id },
      orderBy: { recurrenceKey: "desc" },
      select: { recurrenceKey: true },
    });
    const reset = await tx.financeRecurrence.update({ where: { id }, data: { generatedUntil: last?.recurrenceKey ?? null } });
    const card = reset.cardId ? await tx.creditCard.findUnique({ where: { id: reset.cardId } }) : null;
    await generateOccurrences(tx, reset, card, today);
  }, { timeout: 20000 });
}

/** future: cancela daqui pra frente e mantém o histórico já lançado. all: apaga a regra e todo o histórico. */
export async function deleteRecurrence(id: string, scope: "future" | "all") {
  const today = todayYmd();
  const rule = await prisma.financeRecurrence.findUnique({ where: { id } });
  if (!rule) throw new FinanceError("Recorrência não encontrada", 404);
  if (scope === "all") {
    await prisma.$transaction([
      prisma.financeTransaction.deleteMany({ where: { recurrenceId: id } }),
      prisma.financeRecurrence.delete({ where: { id } }),
    ]);
    return;
  }
  const card = rule.cardId ? await cardRow(rule.cardId) : null;
  const cutoff = cancelRecurrenceCutoff(today, card ? invoiceMonthFor(today, card) : undefined);
  // Cartão não usa paidAt. Corta pela fatura: o que já entrou na aberta (e nas anteriores) fica.
  const futureWhere = rule.cardId
    ? { recurrenceId: id, invoiceMonth: { gt: cutoff.keepThroughKey } }
    : { recurrenceId: id, paidAt: null, date: { gte: day(today) } };
  await prisma.$transaction([
    prisma.financeTransaction.deleteMany({ where: futureWhere }),
    prisma.financeRecurrence.update({ where: { id }, data: { endDate: day(cutoff.endDate) } }),
  ]);
}

// ---------------------------------------------------------------- lançamentos

export type TransactionFilter = {
  month?: MonthKey;
  accountId?: string;
  cardId?: string;
  categoryId?: string;
  kind?: "income" | "expense" | "other";
  status?: "paid" | "pending" | "overdue";
  q?: string;
};

export async function listTransactions(filter: TransactionFilter): Promise<FinTransaction[]> {
  const today = todayYmd();
  await syncRecurrences(today);
  const and: Prisma.FinanceTransactionWhereInput[] = [];
  if (filter.month) and.push({ date: { gte: day(`${filter.month}-01`), lte: day(monthEnd(filter.month)) } });
  if (filter.accountId) and.push({ OR: [{ accountId: filter.accountId }, { toAccountId: filter.accountId }] });
  if (filter.cardId) and.push({ cardId: filter.cardId });
  if (filter.categoryId) {
    const children = await prisma.financeCategory.findMany({ where: { parentId: filter.categoryId }, select: { id: true } });
    and.push({ categoryId: { in: [filter.categoryId, ...children.map((child) => child.id)] } });
  }
  if (filter.kind === "income" || filter.kind === "expense") and.push({ kind: filter.kind });
  if (filter.kind === "other") and.push({ kind: { in: ["transfer", "card_payment", "adjustment", "loan_disbursement"] } });
  if (filter.status === "paid") and.push({ paidAt: { not: null } });
  if (filter.status === "pending" || filter.status === "overdue") {
    and.push({
      paidAt: null,
      cardId: null,
      kind: { in: ["income", "expense"] },
      date: filter.status === "pending" ? { gte: day(today) } : { lt: day(today) },
    });
  }
  if (filter.q) and.push({ description: { contains: filter.q, mode: "insensitive" } });
  const rows = await prisma.financeTransaction.findMany({
    where: { AND: and },
    include: txInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });
  return rows.map((row) => toTransaction(row, today));
}

/** Pago agora: na data, ou hoje se a data ainda não chegou. */
const paidDate = (date: Ymd, today: Ymd) => (date <= today ? date : today);

export async function createEntry(input: EntryInput): Promise<{ ids: string[]; recurrenceId?: string }> {
  const today = todayYmd();
  switch (input.mode) {
    case "one_off": {
      await assertAccount(input.accountId);
      await assertCategory(input.categoryId, input.kind);
      const paid = input.paid ?? input.date <= today;
      const row = await prisma.financeTransaction.create({
        data: {
          kind: input.kind,
          description: input.description,
          amountCents: input.amountCents,
          date: day(input.date),
          paidAt: paid ? day(paidDate(input.date, today)) : null,
          accountId: input.accountId,
          categoryId: input.categoryId ?? null,
          tags: input.tags ?? [],
          notes: input.notes ?? "",
        },
      });
      return { ids: [row.id] };
    }

    case "card": {
      const card = await cardRow(input.cardId);
      await assertCategory(input.categoryId, "expense");
      const count = input.installments;
      const amounts = splitInstallments(input.amountCents, count);
      const firstInvoice = input.invoiceMonth ?? invoiceMonthFor(input.date, card);
      const group = count > 1 ? randomUUID() : null;
      const data = [];
      for (let number = 1; number <= count; number += 1) {
        data.push({
          kind: "expense",
          description: input.description,
          amountCents: amounts[number - 1],
          date: day(addMonthsYmd(input.date, number - 1)),
          cardId: card.id,
          invoiceMonth: addMonthsToKey(firstInvoice, number - 1),
          categoryId: input.categoryId ?? null,
          installmentGroupId: group,
          installmentNumber: count > 1 ? number : null,
          installmentCount: count > 1 ? count : null,
          tags: input.tags ?? [],
          notes: input.notes ?? "",
        });
      }
      const rows = await prisma.financeTransaction.createManyAndReturn({ data, select: { id: true } });
      return { ids: rows.map((row) => row.id) };
    }

    case "recurring": {
      if (Boolean(input.accountId) === Boolean(input.cardId)) throw new FinanceError("Escolha uma conta ou um cartão");
      if (input.cardId && input.kind === "income") throw new FinanceError("Receita entra numa conta, não num cartão");
      if (input.endDate && input.endDate < input.startDate) throw new FinanceError("A data final precisa ser depois do início");
      if (input.accountId) await assertAccount(input.accountId);
      const card = input.cardId ? await cardRow(input.cardId) : null;
      await assertCategory(input.categoryId, input.kind);
      const created = await prisma.$transaction(async (tx) => {
        const rule = await tx.financeRecurrence.create({
          data: {
            kind: input.kind,
            type: input.type,
            description: input.description,
            amountCents: input.amountCents,
            categoryId: input.categoryId ?? null,
            accountId: input.accountId ?? null,
            cardId: input.cardId ?? null,
            intervalMonths: input.intervalMonths,
            dayOfMonth: input.dayOfMonth,
            startDate: day(input.startDate),
            endDate: input.endDate ? day(input.endDate) : null,
            tags: input.tags ?? [],
            notes: input.notes ?? "",
          },
        });
        const ids = await generateOccurrences(tx, rule, card, today);
        if (input.firstPaid && !rule.cardId && input.startDate <= today) {
          await tx.financeTransaction.updateMany({
            where: { recurrenceId: rule.id, recurrenceKey: monthOf(input.startDate) },
            data: { paidAt: day(input.startDate) },
          });
        }
        return { ids, recurrenceId: rule.id };
      });
      return created;
    }

    case "transfer": {
      if (input.accountId === input.toAccountId) throw new FinanceError("Escolha contas diferentes");
      await assertAccount(input.accountId);
      await assertAccount(input.toAccountId);
      const row = await prisma.financeTransaction.create({
        data: {
          kind: "transfer",
          description: input.description || "Transferência",
          amountCents: input.amountCents,
          date: day(input.date),
          paidAt: input.date <= today ? day(input.date) : null,
          accountId: input.accountId,
          toAccountId: input.toAccountId,
          tags: input.tags ?? [],
          notes: input.notes ?? "",
        },
      });
      return { ids: [row.id] };
    }
  }
}

type TxPatch = z.infer<typeof transactionPatch>;

function loanLocked(row: FinanceTransaction) {
  return Boolean(row.loanId) && row.kind === "expense";
}

async function convertToRecurrence(row: FinanceTransaction, patch: TxPatch) {
  const spec = patch.recurrence;
  if (!spec) return;
  if (row.kind !== "expense" && row.kind !== "income") throw new FinanceError("Só despesa ou receita vira recorrente");
  if (row.recurrenceId) throw new FinanceError("Este lançamento já é recorrente");
  const amount = patch.amountCents ?? row.amountCents;
  if (amount <= 0) throw new FinanceError("Valor inválido");
  const cardId = patch.cardId === undefined ? row.cardId : patch.cardId;
  const accountId = cardId ? null : typeof patch.accountId === "string" ? patch.accountId : row.accountId;
  if (Boolean(accountId) === Boolean(cardId)) throw new FinanceError("Escolha uma conta ou um cartão");
  if (cardId && row.kind === "income") throw new FinanceError("Receita entra numa conta, não num cartão");
  if (spec.endDate && spec.endDate < spec.startDate) throw new FinanceError("A data final precisa ser depois do início");
  if (accountId) await assertAccount(accountId);
  const card = cardId ? await cardRow(cardId) : null;
  await assertCategory(patch.categoryId !== undefined ? patch.categoryId : row.categoryId, row.kind);
  const today = todayYmd();
  const dayOfMonth = spec.dayOfMonth ?? parseYmd(spec.startDate).d;
  await prisma.$transaction(async (tx) => {
    const rule = await tx.financeRecurrence.create({
      data: {
        kind: row.kind,
        type: spec.type,
        description: patch.description ?? row.description,
        amountCents: amount,
        categoryId: patch.categoryId !== undefined ? patch.categoryId : row.categoryId,
        accountId: cardId ? null : accountId,
        cardId,
        intervalMonths: spec.intervalMonths,
        dayOfMonth,
        startDate: day(spec.startDate),
        endDate: spec.endDate ? day(spec.endDate) : null,
        tags: patch.tags ?? row.tags,
        notes: patch.notes !== undefined ? patch.notes : row.notes,
      },
    });
    await generateOccurrences(tx, rule, card, today);
    const paidAt = patch.paidAt === undefined ? optionalDay(row.paidAt) : patch.paidAt;
    if (paidAt && !cardId && spec.startDate <= today) {
      await tx.financeTransaction.updateMany({
        where: { recurrenceId: rule.id, recurrenceKey: monthOf(spec.startDate) },
        data: { paidAt: day(paidAt) },
      });
    }
    if (row.installmentGroupId) {
      await tx.financeTransaction.deleteMany({ where: { installmentGroupId: row.installmentGroupId } });
    } else {
      await tx.financeTransaction.delete({ where: { id: row.id } });
    }
  });
}

async function reshapeCardExpense(row: FinanceTransaction, patch: TxPatch) {
  if (row.kind !== "expense") throw new FinanceError("Só despesa pode ir para o cartão");
  if (row.recurrenceId) throw new FinanceError("Despesa recorrente: mude o cartão na regra (Fixa ou Variável)");
  const leavingCard = patch.cardId === null;
  if (leavingCard) {
    const accountId = patch.accountId ?? row.accountId;
    if (!accountId) throw new FinanceError("Escolha a conta");
    await assertAccount(accountId);
    const purchaseDate = patch.date ?? purchaseDateOf(toYmd(row.date), row.installmentNumber);
    const siblings = row.installmentGroupId
      ? await prisma.financeTransaction.findMany({ where: { installmentGroupId: row.installmentGroupId } })
      : [row];
    const total = patch.amountCents && patch.amountCents > 0 ? patch.amountCents : purchaseTotalFromSiblings(siblings, row.installmentCount ?? siblings.length);
    await prisma.$transaction(async (tx) => {
      if (row.installmentGroupId) {
        await tx.financeTransaction.deleteMany({ where: { installmentGroupId: row.installmentGroupId, id: { not: row.id } } });
      }
      await tx.financeTransaction.update({
        where: { id: row.id },
        data: {
          accountId,
          cardId: null,
          invoiceMonth: null,
          installmentGroupId: null,
          installmentNumber: null,
          installmentCount: null,
          amountCents: total,
          date: day(purchaseDate),
          paidAt: patch.paidAt === undefined ? null : patch.paidAt ? day(patch.paidAt) : null,
          description: patch.description ?? row.description,
          categoryId: patch.categoryId !== undefined ? patch.categoryId : row.categoryId,
          tags: patch.tags ?? row.tags,
          notes: patch.notes !== undefined ? patch.notes : row.notes,
        },
      });
    });
    return;
  }

  const cardId = typeof patch.cardId === "string" ? patch.cardId : row.cardId;
  if (!cardId) throw new FinanceError("Escolha o cartão");
  const card = await cardRow(cardId);
  const siblings = row.installmentGroupId
    ? await prisma.financeTransaction.findMany({ where: { installmentGroupId: row.installmentGroupId } })
    : [row];
  const currentCount = row.installmentCount ?? (siblings.length > 1 ? siblings.length : 1);
  const count = patch.installmentCount ?? currentCount;
  const purchaseDate = patch.date ?? purchaseDateOf(toYmd(row.date), row.installmentNumber);
  const total = patch.amountCents && patch.amountCents > 0 ? patch.amountCents : purchaseTotalFromSiblings(siblings, currentCount);
  const firstInvoice =
    count === 1 && patch.invoiceMonth ? patch.invoiceMonth : invoiceMonthFor(purchaseDate, card);
  const planned = planCardInstallments({ purchaseDate, totalCents: total, count, start: 1, firstInvoice });
  const group = count > 1 ? (row.installmentGroupId ?? randomUUID()) : null;
  const shared = {
    description: patch.description ?? row.description,
    categoryId: patch.categoryId !== undefined ? patch.categoryId : row.categoryId,
    tags: patch.tags ?? row.tags,
    notes: patch.notes !== undefined ? patch.notes : row.notes,
  };
  await prisma.$transaction(async (tx) => {
    if (row.installmentGroupId) {
      await tx.financeTransaction.deleteMany({ where: { installmentGroupId: row.installmentGroupId, id: { not: row.id } } });
    }
    const first = planned[0];
    await tx.financeTransaction.update({
      where: { id: row.id },
      data: {
        kind: "expense",
        description: shared.description,
        amountCents: first.amountCents,
        date: day(first.date),
        paidAt: null,
        accountId: null,
        toAccountId: null,
        cardId: card.id,
        invoiceMonth: first.invoiceMonth,
        categoryId: shared.categoryId,
        installmentGroupId: group,
        installmentNumber: count > 1 ? first.number : null,
        installmentCount: count > 1 ? count : null,
        tags: shared.tags,
        notes: shared.notes,
      },
    });
    if (planned.length > 1) {
      await tx.financeTransaction.createMany({
        data: planned.slice(1).map((item) => ({
          kind: "expense",
          description: shared.description,
          amountCents: item.amountCents,
          date: day(item.date),
          cardId: card.id,
          invoiceMonth: item.invoiceMonth,
          categoryId: shared.categoryId,
          installmentGroupId: group,
          installmentNumber: item.number,
          installmentCount: count,
          tags: shared.tags,
          notes: shared.notes,
        })),
      });
    }
  });
}

export async function getTransaction(id: string) {
  const today = todayYmd();
  const row = await prisma.financeTransaction.findUnique({ where: { id } });
  if (!row) throw new FinanceError("Lançamento não encontrado", 404);
  const siblings = row.installmentGroupId
    ? await prisma.financeTransaction.findMany({ where: { installmentGroupId: row.installmentGroupId } })
    : [row];
  return {
    transaction: toTransaction(row, today),
    purchaseDate: purchaseDateOf(toYmd(row.date), row.installmentNumber),
    purchaseTotalCents: purchaseTotalFromSiblings(siblings, row.installmentCount ?? siblings.length),
    startInstallment: Math.min(...siblings.map((item) => item.installmentNumber ?? 1)),
  };
}

export async function updateTransaction(id: string, patch: TxPatch) {
  const row = await prisma.financeTransaction.findUnique({ where: { id }, include: { card: true } });
  if (!row) throw new FinanceError("Lançamento não encontrado", 404);
  const reshape =
    patch.cardId !== undefined ||
    patch.installmentCount !== undefined ||
    patch.startInstallment !== undefined ||
    Boolean(row.installmentGroupId && patch.date !== undefined);
  if (loanLocked(row) && (reshape || patch.recurrence)) {
    throw new FinanceError("Parcela de empréstimo: ajuste na aba Empréstimos");
  }
  if (patch.recurrence) {
    if (row.recurrenceId) {
      await updateRecurrence(row.recurrenceId, {
        description: patch.description,
        amountCents: patch.amountCents && patch.amountCents > 0 ? patch.amountCents : undefined,
        categoryId: patch.categoryId,
        accountId: typeof patch.accountId === "string" ? patch.accountId : undefined,
        cardId: typeof patch.cardId === "string" ? patch.cardId : undefined,
        type: patch.recurrence.type,
        intervalMonths: patch.recurrence.intervalMonths,
        startDate: patch.recurrence.startDate,
        endDate: patch.recurrence.endDate,
        dayOfMonth: patch.recurrence.dayOfMonth,
        tags: patch.tags,
        notes: patch.notes,
      });
      return;
    }
    await convertToRecurrence(row, patch);
    return;
  }
  if (reshape) {
    await reshapeCardExpense(row, patch);
    return;
  }

  const onCard = Boolean(row.cardId) && row.kind === "expense";
  const data: Prisma.FinanceTransactionUncheckedUpdateInput = {};
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.amountCents !== undefined) {
    if (row.kind === "adjustment" ? patch.amountCents === 0 : patch.amountCents <= 0) throw new FinanceError("Valor inválido");
    data.amountCents = patch.amountCents;
  }
  if (patch.date !== undefined) {
    data.date = day(patch.date);
    if (onCard && patch.invoiceMonth === undefined && row.card) data.invoiceMonth = invoiceMonthFor(patch.date, row.card);
  }
  if (patch.invoiceMonth !== undefined) {
    if (!row.cardId) throw new FinanceError("Só lançamentos de cartão têm fatura");
    data.invoiceMonth = patch.invoiceMonth;
  }
  if (patch.paidAt !== undefined) {
    if (onCard) throw new FinanceError("Compras no cartão são pagas pela fatura");
    data.paidAt = patch.paidAt ? day(patch.paidAt) : null;
  }
  if (patch.clearedAt !== undefined) {
    data.clearedAt = patch.clearedAt ? day(patch.clearedAt) : null;
  }
  if (patch.categoryId !== undefined) {
    await assertCategory(patch.categoryId, row.kind);
    data.categoryId = patch.categoryId;
  }
  if (patch.accountId !== undefined) {
    if (onCard) throw new FinanceError("Para trocar o cartão, escolha o cartão nesta tela");
    if (!patch.accountId) throw new FinanceError("Escolha uma conta");
    await assertAccount(patch.accountId);
    data.accountId = patch.accountId;
  }
  if (patch.toAccountId !== undefined) {
    if (row.kind !== "transfer") throw new FinanceError("Só transferências têm conta de destino");
    await assertAccount(patch.toAccountId);
    data.toAccountId = patch.toAccountId;
  }
  if (row.kind === "transfer" && (data.accountId ?? row.accountId) === (data.toAccountId ?? row.toAccountId)) {
    throw new FinanceError("Escolha contas diferentes");
  }
  if (patch.tags !== undefined) data.tags = patch.tags;
  if (patch.notes !== undefined) data.notes = patch.notes;
  await prisma.financeTransaction.update({ where: { id }, data });

  if (patch.applyToGroup && row.installmentGroupId) {
    const shared: Prisma.FinanceTransactionUncheckedUpdateManyInput = {};
    if (patch.description !== undefined) shared.description = patch.description;
    if (patch.categoryId !== undefined) shared.categoryId = patch.categoryId;
    if (patch.tags !== undefined) shared.tags = patch.tags;
    if (Object.keys(shared).length > 0) {
      await prisma.financeTransaction.updateMany({ where: { installmentGroupId: row.installmentGroupId }, data: shared });
    }
  }
}

/** one: só este. group: todas as parcelas. future: este e os próximos da recorrência. */
export async function deleteTransaction(id: string, scope: "one" | "group" | "future") {
  const row = await prisma.financeTransaction.findUnique({ where: { id } });
  if (!row) throw new FinanceError("Lançamento não encontrado", 404);
  if (row.loanId && row.kind === "expense") {
    throw new FinanceError("É uma parcela de empréstimo. Para apagar, exclua o empréstimo na aba Empréstimos.");
  }
  if (scope === "group" && row.installmentGroupId) {
    await prisma.financeTransaction.deleteMany({ where: { installmentGroupId: row.installmentGroupId } });
    return;
  }
  if (scope === "future" && row.recurrenceId) {
    await prisma.$transaction([
      prisma.financeTransaction.deleteMany({
        where: { recurrenceId: row.recurrenceId, OR: [{ id }, { paidAt: null, date: { gt: row.date } }] },
      }),
      prisma.financeRecurrence.update({
        where: { id: row.recurrenceId },
        data: { endDate: day(addDaysYmd(toYmd(row.date), -1)) },
      }),
    ]);
    return;
  }
  await prisma.financeTransaction.delete({ where: { id } });
}

// ---------------------------------------------------------------- empréstimos

function summarizeLoan(loan: Loan, rows: FinanceTransaction[], today: Ymd): FinLoanDetail {
  const terms = {
    principalCents: loan.principalCents,
    monthlyRate: loan.monthlyRate,
    installmentCount: loan.installmentCount,
    amortization: loan.amortization as "price" | "sac",
    installmentCents: loan.installmentCents,
    firstDueDate: toYmd(loan.firstDueDate),
  };
  const base = buildSchedule(terms);
  const expenses = rows.filter((row) => row.kind === "expense");
  const settlementRow = expenses.find((row) => row.installmentNumber == null);
  const settled = Boolean(settlementRow?.paidAt);
  const byNumber = new Map(expenses.filter((row) => row.installmentNumber != null).map((row) => [row.installmentNumber, row]));
  const schedule: FinLoanDetail["schedule"] = base.map((item) => {
    if (item.number <= loan.paidBeforeCount) return { ...item, status: "paid_before" as const, transactionId: null, paidAt: null };
    const row = byNumber.get(item.number);
    if (!row) {
      return {
        ...item,
        status: settled ? "settled" : "pending",
        transactionId: null,
        paidAt: settled ? optionalDay(settlementRow?.paidAt ?? null) : null,
      };
    }
    const dueDate = toYmd(row.date);
    const paidAt = optionalDay(row.paidAt);
    return {
      ...item,
      dueDate,
      amountCents: row.amountCents,
      status: paidAt ? "paid" : dueDate < today ? "overdue" : "pending",
      transactionId: row.id,
      paidAt,
    };
  });
  const open = schedule.filter((item) => item.status === "pending" || item.status === "overdue");
  const done = schedule.filter((item) => item.status === "paid" || item.status === "paid_before" || item.status === "settled");
  const sum = (list: typeof schedule, pick: (item: (typeof schedule)[number]) => number) => list.reduce((total, item) => total + pick(item), 0);
  const next = open.find((item) => item.transactionId);
  const quotes = open.length > 0 ? payoffQuotes(open, loan.monthlyRate, today) : [];
  return {
    id: loan.id,
    name: loan.name,
    lender: loan.lender,
    type: loan.type,
    principalCents: loan.principalCents,
    feesCents: loan.feesCents,
    monthlyRate: loan.monthlyRate,
    annualRate: annualRate(loan.monthlyRate),
    amortization: terms.amortization,
    installmentCount: loan.installmentCount,
    installmentCents: loan.installmentCents,
    firstDueDate: terms.firstDueDate,
    contractDate: optionalDay(loan.contractDate),
    paidBeforeCount: loan.paidBeforeCount,
    accountId: loan.accountId,
    categoryId: loan.categoryId,
    notes: loan.notes,
    paidCount: done.length,
    remainingCount: open.length,
    overdueCount: open.filter((item) => item.status === "overdue").length,
    balanceCents: sum(open, (item) => item.amountCents),
    principalRemainingCents: sum(open, (item) => item.principalCents),
    interestPaidCents: sum(done, (item) => item.interestCents),
    interestRemainingCents: sum(open, (item) => item.interestCents),
    totalInterestCents: sum(schedule, (item) => item.interestCents),
    totalCostCents: sum(schedule, (item) => item.amountCents) + loan.feesCents,
    nextDue: next && next.transactionId ? { date: next.dueDate, amountCents: next.amountCents, transactionId: next.transactionId } : null,
    cet: effectiveCost({
      principalCents: loan.principalCents,
      feesCents: loan.feesCents,
      contractDate: optionalDay(loan.contractDate),
      firstDueDate: terms.firstDueDate,
      schedule: base,
    }),
    payoff: quotes.find((quote) => quote.key === "cdc") ?? payoffToday(open, loan.monthlyRate, today),
    quotes,
    settlement: settlementRow
      ? { transactionId: settlementRow.id, date: toYmd(settlementRow.date), amountCents: settlementRow.amountCents }
      : null,
    schedule,
  };
}

export async function listLoans(today = todayYmd()): Promise<FinLoan[]> {
  const loans = await prisma.loan.findMany({ include: { transactions: true }, orderBy: { createdAt: "asc" } });
  return loans.map((loan) => {
    const { schedule, quotes, settlement, ...summary } = summarizeLoan(loan, loan.transactions, today);
    void schedule;
    void quotes;
    void settlement;
    return summary;
  });
}

export async function getLoan(id: string): Promise<FinLoanDetail> {
  const loan = await prisma.loan.findUnique({ where: { id }, include: { transactions: true } });
  if (!loan) throw new FinanceError("Empréstimo não encontrado", 404);
  return summarizeLoan(loan, loan.transactions, todayYmd());
}

export async function createLoan(input: LoanInput) {
  const today = todayYmd();
  await assertAccount(input.accountId);
  if (input.disbursement) await assertAccount(input.disbursement.accountId);
  const count = input.installmentCount;
  const amortization = input.amortization ?? "price";
  let rate = input.monthlyRate;
  let installment: number | null = null;
  if (amortization === "price") {
    if (input.installmentCents) {
      installment = input.installmentCents;
      rate ??= impliedMonthlyRate(input.principalCents, installment, count);
    } else if (rate !== undefined) {
      installment = pricePayment(input.principalCents, rate, count);
    } else {
      throw new FinanceError("Informe a taxa de juros ou o valor da parcela");
    }
  } else if (rate === undefined) {
    throw new FinanceError("No SAC, informe a taxa de juros");
  }
  const monthlyRate = rate ?? 0;
  const paidBefore = input.paidBeforeCount ?? 0;
  if (paidBefore >= count) throw new FinanceError("As parcelas já pagas precisam ser menos que o total");
  if ((input.feesCents ?? 0) >= input.principalCents) throw new FinanceError("IOF e tarifas precisam ser menores que o valor contratado");
  await assertCategory(input.categoryId, "expense");
  const categoryId =
    input.categoryId ?? (await prisma.financeCategory.findUnique({ where: { system: "emprestimos" }, select: { id: true } }))?.id ?? null;
  const schedule = buildSchedule({
    principalCents: input.principalCents,
    monthlyRate,
    installmentCount: count,
    amortization,
    installmentCents: installment,
    firstDueDate: input.firstDueDate,
  });

  const id = await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.create({
      data: {
        name: input.name,
        lender: input.lender ?? "",
        type: input.type ?? "personal",
        principalCents: input.principalCents,
        feesCents: input.feesCents ?? 0,
        monthlyRate,
        amortization,
        installmentCount: count,
        installmentCents: installment,
        firstDueDate: day(input.firstDueDate),
        contractDate: input.contractDate ? day(input.contractDate) : null,
        paidBeforeCount: paidBefore,
        accountId: input.accountId,
        categoryId,
        notes: input.notes ?? "",
      },
    });
    await tx.financeTransaction.createMany({
      data: schedule
        .filter((row) => row.number > paidBefore)
        .map((row) => ({
          kind: "expense",
          description: input.name,
          amountCents: row.amountCents,
          date: day(row.dueDate),
          accountId: input.accountId,
          categoryId,
          loanId: loan.id,
          installmentNumber: row.number,
          installmentCount: count,
          interestCents: row.interestCents,
        })),
    });
    if (input.disbursement) {
      await tx.financeTransaction.create({
        data: {
          kind: "loan_disbursement",
          description: `Entrada: ${input.name}`,
          amountCents: input.disbursement.amountCents,
          date: day(input.disbursement.date),
          paidAt: input.disbursement.date <= today ? day(input.disbursement.date) : null,
          accountId: input.disbursement.accountId,
          loanId: loan.id,
        },
      });
    }
    return loan.id;
  });
  return { id };
}

export async function deleteLoan(id: string) {
  const loan = await prisma.loan.findUnique({ where: { id }, select: { id: true } });
  if (!loan) throw new FinanceError("Empréstimo não encontrado", 404);
  await prisma.loan.delete({ where: { id } });
}

/**
 * Quita as parcelas em aberto: apaga o que ainda não foi pago e lança um único
 * débito pago no dia de hoje (mês atual), no valor da simulação escolhida.
 */
export async function settleLoan(id: string, input: LoanSettleInput) {
  const today = todayYmd();
  const loan = await prisma.loan.findUnique({ where: { id }, include: { transactions: true } });
  if (!loan) throw new FinanceError("Empréstimo não encontrado", 404);
  const detail = summarizeLoan(loan, loan.transactions, today);
  if (detail.settlement) throw new FinanceError("Este empréstimo já foi quitado");
  if (detail.remainingCount === 0) throw new FinanceError("Não há parcelas em aberto para quitar");
  const quote = detail.quotes.find((item) => item.key === input.scenario);
  if (!quote) throw new FinanceError("Escolha um cenário de quitação");
  if (input.payoffCents !== quote.payoffCents) {
    throw new FinanceError("O valor não bate com a simulação. Recarregue e tente de novo.");
  }
  const accountId = input.accountId ?? loan.accountId;
  if (!accountId) throw new FinanceError("Escolha a conta que paga a quitação");
  await assertAccount(accountId);
  const openIds = detail.schedule
    .filter((row) => (row.status === "pending" || row.status === "overdue") && row.transactionId)
    .map((row) => row.transactionId as string);
  const remainingPrincipal = detail.principalRemainingCents;
  await prisma.$transaction(async (tx) => {
    if (openIds.length > 0) {
      await tx.financeTransaction.deleteMany({ where: { id: { in: openIds } } });
    }
    await tx.financeTransaction.create({
      data: {
        kind: "expense",
        description: `Quitação: ${loan.name}`,
        amountCents: quote.payoffCents,
        date: day(today),
        paidAt: day(today),
        accountId,
        categoryId: loan.categoryId,
        loanId: loan.id,
        interestCents: Math.max(0, quote.payoffCents - remainingPrincipal),
        notes: `${quote.label}. Economia de ${quote.savingsCents} centavos sobre ${quote.nominalCents} nas parcelas em aberto.`,
      },
    });
  });
  return getLoan(id);
}

// ---------------------------------------------------------------- contas a pagar

const ORIGINS = {
  loans: { key: "loans", label: "Empréstimos", color: "#ef4444" },
  people: { key: "people", label: "Dívidas com pessoas", color: "#ec4899" },
  fixed: { key: "fixed", label: "Contas fixas", color: "#7b68ee" },
  variable: { key: "variable", label: "Contas variáveis", color: "#0ea5e9" },
  oneOff: { key: "one_off", label: "Pontuais", color: "#f59e0b" },
};

/**
 * Contas a pagar do mês: despesas da conta ainda não pagas (boleto, parcela,
 * dívida) e faturas de cartão com saldo em aberto. Também devolve o que já foi
 * pago no mês e o total a pagar dos próximos 12 meses.
 */
export async function getBills(month: MonthKey): Promise<FinBills> {
  const today = todayYmd();
  await syncRecurrences(today);
  const current = monthOf(today);
  const last = [month, addMonthsToKey(current, 11)].sort()[1];
  const firstPaid = [month, current].sort()[0];

  const [rows, cardItems] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: {
        kind: "expense",
        cardId: null,
        date: { lte: day(monthEnd(last)) },
        OR: [{ paidAt: null }, { date: { gte: day(`${firstPaid}-01`) } }],
      },
      include: { ...txInclude, loan: { select: { name: true, type: true, lender: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    cardsWithInvoices(today),
  ]);

  const items: FinBill[] = [];
  for (const row of rows) {
    const transaction = toTransaction(row, today);
    let origin = ORIGINS.oneOff;
    let detail = "Pontual";
    if (row.loan) {
      origin = row.loan.type === "person" ? ORIGINS.people : ORIGINS.loans;
      const who = row.loan.lender && row.loan.lender !== row.loan.name ? ` · ${row.loan.lender}` : "";
      detail = `Parcela ${row.installmentNumber ?? "?"}/${row.installmentCount ?? "?"}${who}`;
    } else if (row.recurrenceId) {
      const variable = transaction.nature === "variable";
      origin = variable ? ORIGINS.variable : ORIGINS.fixed;
      detail = variable ? "Conta variável: confirme o valor" : "Conta fixa";
    }
    items.push({
      id: row.id,
      source: "transaction",
      description: row.description,
      detail,
      dueDate: transaction.date,
      amountCents: row.amountCents,
      status: billStatus(transaction.date, today, transaction.paidAt !== null),
      paidAt: transaction.paidAt,
      origin,
      accountId: row.accountId,
      cardId: null,
      invoiceMonth: null,
      invoiceOpen: false,
      transaction,
    });
  }

  for (const { card, invoices } of cardItems) {
    for (const invoice of invoices) {
      const origin = { key: `card:${card.id}`, label: card.name, color: card.color };
      const base = {
        source: "invoice" as const,
        description: `Fatura ${card.name}`,
        dueDate: invoice.dueDate,
        origin,
        accountId: card.paymentAccountId,
        cardId: card.id,
        invoiceMonth: invoice.month,
        transaction: null,
      };
      const count = `${invoice.count} ${invoice.count === 1 ? "compra" : "compras"}`;
      if (invoice.openCents > 0) {
        const open = invoice.status === "open" || invoice.status === "future";
        items.push({
          ...base,
          id: `${card.id}:${invoice.month}`,
          detail: `Fatura de ${shortMonth(invoice.month)} · ${count}${invoice.paidCents > 0 ? " · parte já paga" : ""}${open ? " · ainda aberta" : ""}`,
          amountCents: invoice.openCents,
          status: invoice.status === "overdue" ? "overdue" : billStatus(invoice.dueDate, today, false),
          paidAt: null,
          invoiceOpen: open,
        });
      }
      if (invoice.paidCents > 0) {
        items.push({
          ...base,
          id: `${card.id}:${invoice.month}:pago`,
          detail: `Fatura de ${shortMonth(invoice.month)} · ${count}`,
          amountCents: Math.min(invoice.paidCents, invoice.totalCents || invoice.paidCents),
          status: "paid",
          // O resumo da fatura não guarda a data de cada pagamento.
          paidAt: null,
          invoiceOpen: false,
        });
      }
    }
  }

  const { pending, paid, totals } = billsForMonth(items, month, today);
  return {
    today,
    month,
    pending,
    paid,
    totals,
    months: monthsAhead(items, today, 12),
  };
}

// ---------------------------------------------------------------- despesas

function expenseDetail(row: {
  nature: NonNullable<FinTransaction["nature"]>;
  loan: { name: string; lender: string } | null;
  cardName: string | null;
  invoiceMonth: MonthKey | null;
  installmentNumber: number | null;
  installmentCount: number | null;
}) {
  const parts: string[] = [];
  if (row.loan) {
    if (row.installmentNumber && row.installmentCount) {
      parts.push(`Parcela ${row.installmentNumber}/${row.installmentCount}`);
    } else {
      parts.push("Quitação");
    }
    if (row.loan.lender && row.loan.lender !== row.loan.name) parts.push(row.loan.lender);
  } else if (row.installmentNumber && row.installmentCount) {
    parts.push(`Parcela ${row.installmentNumber}/${row.installmentCount}`);
  } else if (row.nature === "variable") {
    parts.push("Variável: confirme o valor");
  } else if (row.nature === "fixed") {
    parts.push("Fixa");
  } else if (row.nature === "one_off") {
    parts.push("Pontual");
  }
  if (row.cardName) {
    parts.push(row.cardName);
    if (row.invoiceMonth) parts.push(`fatura ${shortMonth(row.invoiceMonth)}`);
  }
  return parts.join(" · ") || "Despesa";
}

/**
 * Todas as despesas do mês (pagas, não pagas e atrasadas). O mês é o
 * vencimento: na conta, a data do lançamento; no cartão, o vencimento da fatura.
 * Compra em novembro com fatura em dezembro entra em dezembro.
 * `chartFrom`/`chartTo` definem a janela do gráfico (padrão: 24 meses em volta de hoje).
 */
export async function getExpenses(month: MonthKey, chart?: { from: MonthKey; to: MonthKey }): Promise<FinExpenses> {
  const today = todayYmd();
  await syncRecurrences(today);
  const current = monthOf(today);
  const chartFrom = chart?.from ?? addMonthsToKey(current, -11);
  const chartTo = chart?.to ?? addMonthsToKey(current, 12);
  const from = [addMonthsToKey(current, -EXPENSE_HISTORY_MONTHS), month, chartFrom].sort()[0];
  const to = [addMonthsToKey(current, 24), month, chartTo].sort().at(-1)!;

  const [rows, cards, categories, overrides] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: {
        kind: "expense",
        OR: [{ date: { gte: day(`${from}-01`), lte: day(monthEnd(to)) } }, { paidAt: null, cardId: null, date: { lt: day(`${current}-01`) } }],
      },
      include: { ...txInclude, loan: { select: { name: true, type: true, lender: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.creditCard.findMany({ select: { id: true, name: true, closingDay: true, dueDay: true } }),
    prisma.financeCategory.findMany({ select: { id: true, essential: true } }),
    prisma.cardInvoice.findMany({ select: { cardId: true, month: true, dueDate: true } }),
  ]);

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const essentialIds = new Set(categories.filter((category) => category.essential).map((category) => category.id));
  const dueOverride = new Map(overrides.filter((row) => row.dueDate).map((row) => [`${row.cardId}:${row.month}`, toYmd(row.dueDate!)]));

  const built: FinExpense[] = rows.map((row) => {
    const transaction = toTransaction(row, today);
    const nature = transaction.nature ?? "one_off";
    const card = row.cardId ? cardById.get(row.cardId) : undefined;
    const onCard = Boolean(row.cardId);
    const invoiceMonth = transaction.invoiceMonth;
    const dueDate =
      onCard && card && invoiceMonth
        ? (dueOverride.get(`${card.id}:${invoiceMonth}`) ?? invoiceDates(invoiceMonth, card).dueDate)
        : transaction.date;
    return {
      id: row.id,
      description: row.description,
      detail: expenseDetail({
        nature,
        loan: row.loan,
        cardName: card?.name ?? null,
        invoiceMonth,
        installmentNumber: row.installmentNumber,
        installmentCount: row.installmentCount,
      }),
      amountCents: row.amountCents,
      date: transaction.date,
      dueDate,
      paidAt: transaction.paidAt,
      clearedAt: optionalDay(row.clearedAt),
      status: expenseStatus(dueDate, today, optionalDay(row.clearedAt) !== null),
      nature,
      categoryId: row.categoryId,
      accountId: row.accountId,
      cardId: row.cardId,
      invoiceMonth,
      loanId: row.loanId,
      installmentNumber: row.installmentNumber,
      installmentCount: row.installmentCount,
      tags: row.tags,
      notes: row.notes,
      essential: row.categoryId ? essentialIds.has(row.categoryId) : false,
      carried: false,
      invoiceOverdue: onCard && dueDate < today,
      transaction,
    };
  });

  const { items, totals } = expensesForMonth(built, month, today);
  return { today, month, items, totals, months: expenseMonths(built, chartFrom, chartTo) };
}

// ---------------------------------------------------------------- visões e dashboards

export async function getBootstrap(): Promise<FinBootstrap> {
  const today = todayYmd();
  const [accounts, cards, categories] = await Promise.all([listAccounts(), listCards(today), listCategories()]);
  return { today, accounts, cards, categories };
}

/** +1 entra na conta, −1 sai. Ajuste já vem com sinal. */
function signOf(kind: string) {
  return kind === "income" || kind === "loan_disbursement" || kind === "adjustment" ? 1 : -1;
}

export async function getAnalytics(from: MonthKey, to: MonthKey): Promise<FinAnalytics> {
  const today = todayYmd();
  await syncRecurrences(today);
  const fromDay = day(`${from}-01`);
  const toDay = day(monthEnd(to));
  const agendaLimit = [monthEnd(to), addDaysYmd(today, 45)].sort()[1];

  const [rows, accounts, cardItems, loans] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: {
        kind: { in: ["income", "expense"] },
        OR: [
          { cardId: null, date: { gte: fromDay, lte: toDay } },
          { cardId: { not: null }, invoiceMonth: { gte: from, lte: to } },
        ],
      },
      include: txInclude,
    }),
    listAccounts(),
    cardsWithInvoices(today),
    listLoans(today),
  ]);

  const included = accounts.filter((account) => account.includeInTotals && !account.archived);
  const includedIds = included.map((account) => account.id);
  const startOf = new Map(included.map((account) => [account.id, account.initialBalanceDate]));
  const current = included.reduce((sum, account) => sum + account.balanceCents, 0);

  const [moves, pending] = await Promise.all([
    includedIds.length
      ? prisma.financeTransaction.findMany({
          where: { paidAt: { gte: fromDay }, OR: [{ accountId: { in: includedIds } }, { toAccountId: { in: includedIds } }] },
          select: { kind: true, amountCents: true, accountId: true, toAccountId: true, paidAt: true },
        })
      : Promise.resolve([]),
    prisma.financeTransaction.findMany({
      where: { paidAt: null, cardId: null, kind: { in: ["income", "expense"] }, date: { lte: day(agendaLimit) } },
      select: { id: true, kind: true, description: true, amountCents: true, date: true, accountId: true },
      orderBy: { date: "asc" },
    }),
  ]);

  // Saldo no fim de cada mês: passado = saldo de hoje menos o que entrou/saiu depois;
  // futuro = saldo de hoje mais o que está pendente e as faturas a pagar.
  const deltas = moves.map((move) => {
    const paid = toYmd(move.paidAt as Date);
    let delta = 0;
    const fromStart = move.accountId ? startOf.get(move.accountId) : undefined;
    if (fromStart && paid >= fromStart) delta += signOf(move.kind) * move.amountCents;
    const toStart = move.toAccountId ? startOf.get(move.toAccountId) : undefined;
    if (move.kind === "transfer" && toStart && paid >= toStart) delta += move.amountCents;
    return { paid, delta };
  });
  const invoices = cardItems.flatMap((item) => item.invoices);
  const currentMonth = monthOf(today);
  const balance: BalancePoint[] = monthRange(from, to).map((month) => {
    const end = monthEnd(month);
    if (month < currentMonth) {
      const after = deltas.reduce((sum, item) => (item.paid > end ? sum + item.delta : sum), 0);
      return { month, balanceCents: current - after, projected: false };
    }
    const flows = pending.reduce((sum, item) => {
      if (!item.accountId || !startOf.has(item.accountId) || toYmd(item.date) > end) return sum;
      return sum + (item.kind === "income" ? item.amountCents : -item.amountCents);
    }, 0);
    const bills = invoices.reduce((sum, invoice) => (invoice.openCents > 0 && invoice.dueDate <= end ? sum + invoice.openCents : sum), 0);
    return { month, balanceCents: current + flows - bills, projected: true };
  });

  const agenda: AgendaItem[] = [
    ...pending.map((item) => {
      const date = toYmd(item.date);
      return {
        id: item.id,
        source: "transaction" as const,
        kind: item.kind as FlowKind,
        description: item.description,
        date,
        amountCents: item.amountCents,
        overdue: date < today,
        accountId: item.accountId,
        cardId: null,
        invoiceMonth: null,
      };
    }),
    ...cardItems.flatMap(({ card, invoices: list }) =>
      list
        .filter((invoice) => invoice.openCents > 0 && invoice.status !== "paid" && invoice.dueDate <= agendaLimit)
        .map((invoice) => ({
          id: `${card.id}:${invoice.month}`,
          source: "invoice" as const,
          kind: "expense" as const,
          description: `Fatura ${card.name}`,
          date: invoice.dueDate,
          amountCents: invoice.openCents,
          overdue: invoice.status === "overdue",
          accountId: card.paymentAccountId,
          cardId: card.id,
          invoiceMonth: invoice.month,
        }))
    ),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    today,
    from,
    to,
    facts: rows.map((row) => toFact(row, today)),
    balance,
    currentBalanceCents: current,
    agenda,
    invoices,
    loans,
  };
}

function toDashboard(row: { id: string; name: string; widgets: unknown; order: number; updatedAt: Date }): FinDashboard {
  return {
    id: row.id,
    name: row.name,
    widgets: Array.isArray(row.widgets) ? (row.widgets as WidgetConfig[]) : [],
    order: row.order,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Na primeira visita, cria os dashboards prontos. */
export async function listDashboards(): Promise<FinDashboard[]> {
  const order = [{ order: "asc" as const }, { createdAt: "asc" as const }];
  let rows = await prisma.financeDashboard.findMany({ orderBy: order });
  if (rows.length === 0) {
    // Duas cargas ao mesmo tempo (duas abas, StrictMode) não podem criar os modelos duas vezes:
    // a trava do Postgres deixa uma criar e a outra só ler.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fin-dashboards-seed'))`;
      if ((await tx.financeDashboard.count()) > 0) return;
      await tx.financeDashboard.createMany({
        data: DASHBOARD_TEMPLATES.map((template, index) => ({
          name: template.name,
          widgets: templateWidgets(template.key) as unknown as Prisma.InputJsonValue,
          order: index,
        })),
      });
    });
    rows = await prisma.financeDashboard.findMany({ orderBy: order });
  }
  return rows.map(toDashboard);
}

export async function createDashboard(input: z.infer<typeof dashboardInput>) {
  const order = await prisma.financeDashboard.count();
  const row = await prisma.financeDashboard.create({
    data: { name: input.name, widgets: input.widgets as unknown as Prisma.InputJsonValue, order },
  });
  return toDashboard(row);
}

export async function updateDashboard(id: string, patch: z.infer<typeof dashboardPatch>) {
  const row = await prisma.financeDashboard.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.order !== undefined ? { order: patch.order } : {}),
      ...(patch.widgets !== undefined ? { widgets: patch.widgets as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  return toDashboard(row);
}

export async function deleteDashboard(id: string) {
  await prisma.financeDashboard.delete({ where: { id } });
}

/** Busca despesa pelo texto, em qualquer mês. Serve ao Quick para “já existe?”. */
export async function searchExpenses(q: string, limit = 15) {
  const query = q.trim();
  if (query.length < 2) return [];
  const rows = await prisma.financeTransaction.findMany({
    where: {
      kind: "expense",
      OR: [
        { description: { contains: query, mode: "insensitive" } },
        { notes: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      category: { select: { name: true } },
      account: { select: { name: true } },
      card: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: Math.min(Math.max(limit, 1), 30),
  });
  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    amountCents: row.amountCents,
    date: toYmd(row.date),
    clearedAt: optionalDay(row.clearedAt),
    invoiceMonth: row.invoiceMonth,
    category: row.category?.name ?? null,
    account: row.account?.name ?? null,
    card: row.card?.name ?? null,
    notes: row.notes,
    loanId: row.loanId,
  }));
}
