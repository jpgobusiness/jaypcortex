import assert from "node:assert/strict";
import { test } from "node:test";
import {
  expenseDashboard,
  financeToolPlan,
  isFinanceAsk,
  parseMonthKey,
  parseReais,
} from "./mcp-logic";
import type { FinExpense, FinExpenses } from "./types";

test("valor em reais vira centavos", () => {
  assert.equal(parseReais("89,90"), 8990);
  assert.equal(parseReais("1.234,56"), 123456);
  assert.equal(parseReais("R$ 10"), 1000);
});

test("mês em português vira AAAA-MM", () => {
  assert.equal(parseMonthKey("novembro 2026", "2026-11-25"), "2026-11");
  assert.equal(parseMonthKey("novembro", "2026-11-25"), "2026-11");
  assert.equal(parseMonthKey("", "2026-03-02"), "2026-03");
});

test("pergunta de despesa não vira tarefa e pergunta não paga sozinha", () => {
  assert.equal(isFinanceAsk("lista despesas de novembro"), true);
  assert.equal(isFinanceAsk("já existe a netflix?"), false);
  assert.equal(isFinanceAsk("criar tarefa ligar para o david"), false);
  assert.equal(isFinanceAsk("criar tarefa pagar o aluguel"), false);
  assert.deepEqual(financeToolPlan("já paguei o aluguel?"), ["list_expenses", "search_expenses", "expense_report"]);
  assert.ok(financeToolPlan("marca como paga o aluguel").includes("pay_expense"));
  assert.ok(financeToolPlan("cria despesa netflix 55,90 todo mês").includes("create_recurring_expense"));
  assert.ok(financeToolPlan("cadastra o aluguel de 2000").includes("create_housing_expense"));
});

test("relatório deixa totais prontos em reais e centavos", () => {
  const item = {
    id: "e1",
    description: "Netflix",
    detail: "",
    amountCents: 5590,
    date: "2026-11-05",
    dueDate: "2026-11-10",
    paidAt: null,
    clearedAt: null,
    status: "unpaid",
    nature: "fixed",
    categoryId: "cat",
    accountId: null,
    cardId: "card",
    invoiceMonth: "2026-11",
    loanId: null,
    installmentNumber: null,
    installmentCount: null,
    tags: [],
    notes: "",
    essential: false,
    carried: false,
    invoiceOverdue: false,
    transaction: { recurrenceId: "r1" },
  } as unknown as FinExpense;
  const data: FinExpenses = {
    today: "2026-11-25",
    month: "2026-11",
    items: [item],
    totals: {
      totalCents: 5590,
      paidCents: 0,
      pendingCents: 5590,
      overdueCents: 0,
      overdueCount: 0,
      carriedOverdueCents: 0,
      carriedOverdueCount: 0,
      monthOverdueCents: 0,
    },
    months: [{ month: "2026-11", totalCents: 5590, paidCents: 0, pendingCents: 5590, overdueCents: 0 }],
  };
  const report = expenseDashboard(data, new Map([["cat", "Assinaturas"]]));
  assert.equal(report.totals.total, "R$ 55,90");
  assert.equal(report.totals.total_cents, 5590);
  assert.equal(report.by_category[0].category, "Assinaturas");
  assert.match(report.note, /dashboard/);
});
