import assert from "node:assert/strict";
import { test } from "node:test";
import { breakdown, makeLookup, monthlyFlow, natureOf, periodRange, sankeyData, stackedByMonth, totals } from "./analytics";
import { billStatus, billsForMonth, monthsAhead } from "./bills";
import { chartWindow, expenseMonths, expenseStatus, expensesForMonth } from "./expenses";
import type { ExpenseStatus, FinBill, FinExpense } from "./types";
import { addMonthsYmd, longMonth, monthOf, monthRange, nextBusinessDay, shortMonth, todayYmd } from "./dates";
import { invoiceDates, invoiceMonthFor, invoiceStatus } from "./invoice";
import { annualRate, buildSchedule, effectiveCost, impliedMonthlyRate, payoffQuotes, payoffToday, pricePayment, simulatePayoff } from "./loan";
import { currentCardInstallment, planCardInstallments, purchaseDateOf, purchaseTotalFromSiblings } from "./installments";
import { formatBRL, splitInstallments, toCents } from "./money";
import { applyForecast, housingMonths, housingSystemOf } from "./housing";
import { cancelRecurrenceCutoff, monthlyEquivalent, occurrences } from "./recurrence";
import type { FactRow, FinCategory } from "./types";

test("toCents entende formatos brasileiros e números", () => {
  assert.equal(toCents("1.234,56"), 123456);
  assert.equal(toCents("R$ 10"), 1000);
  assert.equal(toCents("0,5"), 50);
  assert.equal(toCents("1234.5"), 123450);
  assert.equal(toCents("1.000"), 100000);
  assert.equal(toCents(19.99), 1999);
  assert.equal(toCents("-15,00"), -1500);
  assert.equal(toCents("abc"), null);
  assert.equal(toCents(""), null);
  assert.equal(formatBRL(123456).replace(/\s/g, " "), "R$ 1.234,56");
});

test("parcelas somam o total e a sobra vai na primeira", () => {
  assert.deepEqual(splitInstallments(100000, 3), [33334, 33333, 33333]);
  assert.equal(splitInstallments(99999, 7).reduce((a, b) => a + b, 0), 99999);
});

test("fatura da compra: fechamento é o melhor dia de compra (igual ao SQL)", () => {
  const cases: [string, number, number, string][] = [
    ["2026-11-02", 3, 10, "2026-11"],
    ["2026-11-03", 3, 10, "2026-12"],
    ["2026-11-27", 28, 5, "2026-12"],
    ["2026-11-28", 28, 5, "2027-01"],
    ["2026-02-27", 30, 7, "2026-03"],
    ["2026-02-28", 30, 7, "2026-04"],
    ["2026-12-31", 31, 8, "2027-02"],
    ["2026-12-15", 10, 10, "2027-02"],
  ];
  for (const [date, closingDay, dueDay, expected] of cases) {
    assert.equal(invoiceMonthFor(date, { closingDay, dueDay }), expected, `${date} ${closingDay}/${dueDay}`);
  }
});

test("datas da fatura: vencimento no fim de semana vai para segunda", () => {
  assert.equal(nextBusinessDay("2027-01-10"), "2027-01-11"); // domingo
  assert.equal(nextBusinessDay("2027-01-09"), "2027-01-11"); // sábado
  assert.deepEqual(invoiceDates("2027-01", { closingDay: 3, dueDay: 10 }), { closingDate: "2027-01-03", dueDate: "2027-01-11" });
  assert.deepEqual(invoiceDates("2026-12", { closingDay: 28, dueDay: 5 }), { closingDate: "2026-11-28", dueDate: "2026-12-07" });
  assert.equal(invoiceDates("2026-12", { closingDay: 3, dueDay: 10 }, { dueDate: "2026-12-14" }).dueDate, "2026-12-14");
});

test("status da fatura", () => {
  const base = { openMonth: "2026-12", dueDate: "2026-11-10", today: "2026-11-20" };
  assert.equal(invoiceStatus({ ...base, month: "2026-12", totalCents: 100, paidCents: 0 }), "open");
  assert.equal(invoiceStatus({ ...base, month: "2027-01", totalCents: 100, paidCents: 0 }), "future");
  assert.equal(invoiceStatus({ ...base, month: "2026-11", totalCents: 100, paidCents: 100 }), "paid");
  assert.equal(invoiceStatus({ ...base, month: "2026-11", totalCents: 100, paidCents: 40 }), "overdue");
  assert.equal(invoiceStatus({ ...base, month: "2026-11", totalCents: 100, paidCents: 0, today: "2026-11-05" }), "closed");
});

test("recorrência mensal respeita fim do mês, intervalo e data final", () => {
  const monthly = occurrences({ startDate: "2027-01-31", endDate: null, intervalMonths: 1, dayOfMonth: 31 }, null, "2027-04");
  assert.deepEqual(monthly.map((item) => item.date), ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  const quarterly = occurrences({ startDate: "2026-12-20", endDate: "2027-07-01", intervalMonths: 3, dayOfMonth: 20 }, null, "2027-12");
  assert.deepEqual(quarterly.map((item) => item.key), ["2026-12", "2027-03", "2027-06"]);
  const after = occurrences({ startDate: "2026-11-05", endDate: null, intervalMonths: 1, dayOfMonth: 5 }, "2026-12", "2027-02");
  assert.deepEqual(after.map((item) => item.key), ["2027-01", "2027-02"]);
  assert.equal(monthlyEquivalent(300000, 3), 100000);
});

test("cancelar assinatura no cartão mantém o mês atual e só corta os seguintes", () => {
  const cutoff = cancelRecurrenceCutoff("2026-11-17");
  assert.equal(cutoff.keepThroughKey, "2026-11");
  assert.equal(cutoff.endDate, "2026-11-16");
  const leftover = occurrences({ startDate: "2026-08-05", endDate: cutoff.endDate, intervalMonths: 1, dayOfMonth: 5 }, null, "2027-11");
  assert.deepEqual(leftover.map((item) => item.key), ["2026-08", "2026-09", "2026-10", "2026-11"]);
  // Depois do fechamento, a fatura aberta já é o mês seguinte — essa também fica.
  const afterClosing = cancelRecurrenceCutoff("2026-11-17", "2026-12");
  assert.equal(afterClosing.keepThroughKey, "2026-12");
});

test("aluguel e condomínio: histórico mês a mês e previsão daqui pra frente", () => {
  const months = housingMonths({
    startDate: "2026-01-10",
    dayOfMonth: 10,
    untilKey: "2026-04",
    forecastCents: 200000,
    amounts: { "2026-01": 180000, "2026-02": 185000 },
  });
  assert.deepEqual(
    months.map((item) => [item.key, item.date, item.amountCents]),
    [
      ["2026-01", "2026-01-10", 180000],
      ["2026-02", "2026-02-10", 185000],
      ["2026-03", "2026-03-10", 200000],
      ["2026-04", "2026-04-10", 200000],
    ]
  );
  const filled = applyForecast(months, "2026-03", 220000);
  assert.equal(filled[0].amountCents, 180000);
  assert.equal(filled[1].amountCents, 185000);
  assert.equal(filled[2].amountCents, 220000);
  assert.equal(filled[3].amountCents, 220000);
  assert.equal(housingSystemOf("aluguel", "Qualquer"), "aluguel");
  assert.equal(housingSystemOf(null, "ALUGUEL"), "aluguel");
  assert.equal(housingSystemOf(null, "Condomínio do prédio"), "condominio");
  assert.equal(housingSystemOf(null, "Internet"), null);
});

test("tabela Price: parcela, juros e saldo zerado", () => {
  assert.equal(pricePayment(1_000_000, 2, 12), 94560);
  const rows = buildSchedule({ principalCents: 1_000_000, monthlyRate: 2, installmentCount: 12, amortization: "price", firstDueDate: "2026-12-05" });
  assert.equal(rows.length, 12);
  assert.equal(rows[0].interestCents, 20000);
  assert.equal(rows[11].balanceCents, 0);
  assert.equal(rows[11].dueDate, "2027-11-05");
  const interest = rows.reduce((sum, row) => sum + row.interestCents, 0);
  assert.ok(Math.abs(interest - 134715) <= 3, `juros ${interest}`);
});

test("tabela SAC: amortização constante e parcela caindo", () => {
  const rows = buildSchedule({ principalCents: 1_200_000, monthlyRate: 1, installmentCount: 12, amortization: "sac", firstDueDate: "2027-01-31" });
  assert.equal(rows[0].amountCents, 112000);
  assert.equal(rows[11].amountCents, 101000);
  assert.equal(rows[1].dueDate, "2027-02-28");
  assert.ok(rows.every((row, index) => index === 0 || row.amountCents < rows[index - 1].amountCents));
});

test("taxa implícita, CET e quitação antecipada", () => {
  assert.ok(Math.abs(impliedMonthlyRate(1_000_000, 94560, 12) - 2) < 0.001);
  assert.equal(impliedMonthlyRate(1_000_000, 50000, 12), 0);
  assert.ok(Math.abs(annualRate(2) - 26.824) < 0.01);
  const schedule = buildSchedule({ principalCents: 1_000_000, monthlyRate: 2, installmentCount: 12, amortization: "price", firstDueDate: "2026-12-16" });
  const cet = effectiveCost({ principalCents: 1_000_000, feesCents: 30000, contractDate: "2026-11-16", firstDueDate: "2026-12-16", schedule });
  assert.ok(cet && cet.monthly > 2.4 && cet.monthly < 2.6, `CET ${cet?.monthly}`);
  const payoff = payoffToday(schedule.map((row) => ({ dueDate: row.dueDate, amountCents: row.amountCents })), 2, "2026-11-16");
  assert.ok(payoff.savingsCents > 100000 && payoff.payoffCents < payoff.nominalCents);
  assert.ok(Math.abs(payoff.payoffCents - 1_000_000) < 2000, `quitação ${payoff.payoffCents}`);
  const quotes = payoffQuotes(schedule, 2, "2026-11-16");
  const byKey = Object.fromEntries(quotes.map((quote) => [quote.key, quote]));
  assert.equal(byKey.cdc.payoffCents, payoff.payoffCents);
  assert.equal(byKey.nominal.payoffCents, payoff.nominalCents);
  assert.ok(byKey.cdc.payoffCents < byKey.nominal.payoffCents);
  assert.ok(byKey.cdc.savingsCents > 100000);
});

test("simular quitação numa data: parcelas já vencidas saem e o desconto vale só no que falta", () => {
  const open = [
    { dueDate: "2026-11-18", amountCents: 134500, principalCents: 71208 },
    { dueDate: "2026-12-18", amountCents: 134500, principalCents: 76422 },
    { dueDate: "2027-01-18", amountCents: 134500, principalCents: 82017 },
    { dueDate: "2027-02-18", amountCents: 134500, principalCents: 88022 },
    { dueDate: "2027-03-18", amountCents: 134500, principalCents: 94467 },
    { dueDate: "2027-04-18", amountCents: 134500, principalCents: 101384 },
    { dueDate: "2027-05-18", amountCents: 134500, principalCents: 108807 },
    { dueDate: "2027-06-18", amountCents: 134500, principalCents: 116774 },
    { dueDate: "2027-07-18", amountCents: 134503, principalCents: 125327 },
  ];
  const beforeDue = simulatePayoff(open, 7.32, "2027-02-10");
  assert.equal(beforeDue.assumedPaidCount, 3);
  assert.equal(beforeDue.assumedPaidCents, 403500);
  assert.equal(beforeDue.remainingCount, 6);
  const afterDue = simulatePayoff(open, 7.32, "2027-02-27");
  assert.equal(afterDue.assumedPaidCount, 4);
  assert.equal(afterDue.assumedPaidCents, 538000);
  assert.equal(afterDue.remainingCount, 5);
  const cdc = afterDue.quotes.find((quote) => quote.key === "cdc");
  const nominal = afterDue.quotes.find((quote) => quote.key === "nominal");
  assert.equal(nominal?.payoffCents, 672503);
  assert.ok(cdc && cdc.payoffCents < 672503 && cdc.payoffCents > 450000, `quitação fev/27 ${cdc?.payoffCents}`);
});

test("datas auxiliares", () => {
  assert.equal(addMonthsYmd("2027-01-31", 1), "2027-02-28");
  assert.deepEqual(monthRange("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.equal(shortMonth("2026-11"), "nov/26");
  assert.equal(longMonth("2027-03"), "março de 2027");
  assert.equal(todayYmd("America/Sao_Paulo", new Date("2026-11-17T02:30:00Z")), "2026-11-16");
  assert.deepEqual(periodRange("last3", "2026-01-10"), { from: "2025-11", to: "2026-01" });
});

test("natureza, fluxo mensal, categorias e sankey", () => {
  assert.equal(natureOf({ kind: "expense", loanId: null, installmentGroupId: null, recurrenceId: "r", recurrenceType: "variable" }), "variable");
  assert.equal(natureOf({ kind: "transfer", loanId: null, installmentGroupId: null, recurrenceId: null, recurrenceType: null }), null);

  const category = (id: string, name: string, kind: "income" | "expense", parentId: string | null = null): FinCategory => ({
    id, name, kind, icon: "tag", color: "#000000", parentId, essential: false, system: null, archived: false, order: 0,
  });
  const lookup = makeLookup(
    [category("sal", "Salário", "income"), category("casa", "Moradia", "expense"), category("luz", "Luz", "expense", "casa")],
    [{ id: "acc", name: "Conta", color: "#111111" }],
    [{ id: "card", name: "Cartão", color: "#222222" }]
  );
  const fact = (partial: Partial<FactRow>): FactRow => ({
    id: Math.random().toString(36), kind: "expense", month: "2026-11", date: "2026-11-10", amountCents: 1000, realized: true,
    categoryId: null, accountId: "acc", cardId: null, nature: "one_off", description: "x", tags: [], interestCents: 0, loanId: null,
    ...partial,
  });
  const facts = [
    fact({ kind: "income", categoryId: "sal", amountCents: 800000, nature: "fixed" }),
    fact({ categoryId: "casa", amountCents: 250000, nature: "fixed" }),
    fact({ categoryId: "luz", amountCents: 20000, nature: "variable", month: "2026-12", realized: false }),
    fact({ amountCents: 5000, cardId: "card", accountId: null }),
  ];
  const flow = monthlyFlow(facts, ["2026-11", "2026-12"]);
  assert.deepEqual(flow.map((row) => row.net), [545000, -20000]);
  assert.equal(totals(facts).savingsRate?.toFixed(1), "65.6");
  const groups = breakdown(facts.filter((row) => row.kind === "expense"), "group", lookup);
  assert.deepEqual(groups.map((slice) => [slice.label, slice.value]), [["Moradia", 270000], ["Sem categoria", 5000]]);
  const stacked = stackedByMonth(facts.filter((row) => row.kind === "expense"), ["2026-11", "2026-12"], "nature", lookup);
  assert.equal(stacked.rows[1].variable, 20000);
  const sankey = sankeyData(facts, lookup);
  assert.equal(sankey.nodes.at(-1)?.name, "Sobrou");
  assert.equal(sankey.links.reduce((sum, link) => sum + (link.target === 1 ? link.value : 0), 0), 800000);
});

test("contas a pagar: mês atual leva as atrasadas; meses à frente somam certo", () => {
  const today = "2026-11-16";
  const bill = (id: string, dueDate: string, amountCents: number, paid = false): FinBill => ({
    id, source: "transaction", description: id, detail: "", dueDate, amountCents, status: billStatus(dueDate, today, paid), paidAt: paid ? dueDate : null,
    origin: { key: "x", label: "x", color: "#000000" }, accountId: null, cardId: null, invoiceMonth: null, invoiceOpen: false, transaction: null,
  });
  assert.equal(billStatus("2026-11-16", today, false), "today");
  assert.equal(billStatus("2026-11-05", today, false), "overdue");
  const items = [
    bill("atrasada-outubro", "2026-10-20", 1000),
    bill("atrasada-novembro", "2026-11-05", 2000),
    bill("vence-novembro", "2026-11-26", 3000),
    bill("paga-novembro", "2026-11-10", 500, true),
    bill("dezembro", "2026-12-08", 4000),
  ];
  const nov = billsForMonth(items, "2026-11", today);
  assert.deepEqual(nov.pending.map((item) => item.id), ["atrasada-outubro", "atrasada-novembro", "vence-novembro"]);
  assert.deepEqual(nov.totals, { pendingCents: 6000, paidCents: 500, overdueCents: 3000, overdueCount: 2 });
  const dec = billsForMonth(items, "2026-12", today);
  assert.equal(dec.totals.pendingCents, 4000);
  const oct = billsForMonth(items, "2026-10", today);
  assert.deepEqual(oct.pending.map((item) => item.id), ["atrasada-outubro"]);
  const ahead = monthsAhead(items, today, 3);
  assert.deepEqual(
    ahead.map((row) => [row.month, row.pendingCents, row.paidCents, row.overdueCents]),
    [["2026-11", 6000, 500, 3000], ["2026-12", 4000, 0, 0], ["2027-01", 0, 0, 0]]
  );
});

test("despesas do mês: só o que vence naquele mês; fatura de dezembro não entra em novembro", () => {
  const today = "2026-11-16";
  const expense = (id: string, date: string, amountCents: number, status: ExpenseStatus, dueDate = date, onCard = false): FinExpense => ({
    id,
    description: id,
    detail: "",
    amountCents,
    date,
    dueDate,
    paidAt: null,
    clearedAt: status === "paid" ? date : null,
    status,
    nature: "one_off",
    categoryId: null,
    accountId: null,
    cardId: onCard ? "c1" : null,
    invoiceMonth: onCard ? monthOf(dueDate) : null,
    loanId: null,
    installmentNumber: null,
    installmentCount: null,
    tags: [],
    notes: "",
    essential: false,
    carried: false,
    invoiceOverdue: false,
    transaction: {
      id,
      kind: "expense",
      description: id,
      amountCents,
      date,
      paidAt: null,
      accountId: null,
      toAccountId: null,
      cardId: onCard ? "c1" : null,
      invoiceMonth: onCard ? monthOf(dueDate) : null,
      categoryId: null,
      recurrenceId: null,
      recurrenceKey: null,
      installmentGroupId: null,
      installmentNumber: null,
      installmentCount: null,
      loanId: null,
      interestCents: null,
      tags: [],
      notes: "",
      nature: "one_off",
      status: status === "paid" ? "paid" : status === "overdue" ? "overdue" : "pending",
    },
  });
  assert.equal(expenseStatus("2026-11-16", today, false), "unpaid");
  assert.equal(expenseStatus("2026-11-05", today, false), "overdue");
  assert.equal(expenseStatus("2026-11-20", today, true), "paid");
  assert.equal(expenseStatus("2026-11-01", today, false), "overdue");
  const items = [
    expense("atrasada-outubro", "2026-10-20", 1000, "overdue"),
    expense("atrasada-novembro", "2026-11-05", 2000, "overdue"),
    expense("hoje", "2026-11-16", 1500, "unpaid"),
    expense("a-pagar", "2026-11-26", 3000, "unpaid"),
    expense("paga", "2026-11-10", 500, "paid"),
    expense("cartao-nov", "2026-11-12", 800, "unpaid", "2026-11-26", true),
    expense("cartao-compra-nov-fatura-dez", "2026-11-16", 537568, "unpaid", "2026-12-08", true),
    expense("dezembro", "2026-12-08", 4000, "unpaid"),
  ];
  const nov = expensesForMonth(items, "2026-11", today);
  assert.deepEqual(
    nov.items.map((item) => item.id),
    ["atrasada-novembro", "paga", "hoje", "a-pagar", "cartao-nov"]
  );
  assert.deepEqual(nov.totals, {
    totalCents: 7800,
    paidCents: 500,
    pendingCents: 5300,
    overdueCents: 2000,
    overdueCount: 1,
    carriedOverdueCents: 0,
    carriedOverdueCount: 0,
    monthOverdueCents: 2000,
  });
  const dec = expensesForMonth(items, "2026-12", today);
  assert.deepEqual(
    dec.items.map((item) => item.id),
    ["cartao-compra-nov-fatura-dez", "dezembro"]
  );
  assert.equal(dec.totals.totalCents, 541568);
  assert.equal(dec.totals.pendingCents, 541568);
  const oct = expensesForMonth(items, "2026-10", today);
  assert.deepEqual(oct.items.map((item) => item.id), ["atrasada-outubro"]);
  const series = expenseMonths(items, "2026-10", "2026-12");
  assert.deepEqual(
    series.map((row) => [row.month, row.totalCents, row.paidCents, row.pendingCents, row.overdueCents]),
    [
      ["2026-10", 1000, 0, 0, 1000],
      ["2026-11", 7800, 500, 5300, 2000],
      ["2026-12", 541568, 0, 541568, 0],
    ]
  );
});

test("gráfico de despesas inclui meses antigos de uma compra parcelada", () => {
  const expense = (id: string, dueDate: string, amountCents: number): FinExpense => ({
    id,
    description: id,
    detail: "",
    amountCents,
    date: dueDate,
    dueDate,
    paidAt: null,
    clearedAt: null,
    status: "unpaid",
    nature: "installment",
    categoryId: null,
    accountId: null,
    cardId: "c1",
    invoiceMonth: monthOf(dueDate),
    loanId: null,
    installmentNumber: null,
    installmentCount: 21,
    tags: [],
    notes: "",
    essential: false,
    carried: false,
    invoiceOverdue: false,
    transaction: {
      id,
      kind: "expense",
      description: id,
      amountCents,
      date: dueDate,
      paidAt: null,
      accountId: null,
      toAccountId: null,
      cardId: "c1",
      invoiceMonth: monthOf(dueDate),
      categoryId: null,
      recurrenceId: null,
      recurrenceKey: null,
      installmentGroupId: "g1",
      installmentNumber: null,
      installmentCount: 21,
      loanId: null,
      interestCents: null,
      tags: [],
      notes: "",
      nature: "installment",
      status: "pending",
    },
  });
  const items = [
    expense("p1-set-25", "2025-09-12", 1000),
    expense("p2-out-25", "2025-10-12", 1000),
    expense("p12-ago-26", "2026-08-12", 1000),
    expense("p14-out-26", "2026-10-12", 1000),
    expense("p15-nov-26", "2026-11-12", 1000),
  ];
  const wide = expenseMonths(items, "2025-09", "2026-11");
  const byMonth = Object.fromEntries(wide.map((row) => [row.month, row.pendingCents + row.overdueCents]));
  assert.equal(byMonth["2025-09"], 1000);
  assert.equal(byMonth["2025-10"], 1000);
  assert.equal(byMonth["2026-08"], 1000);
  assert.equal(byMonth["2026-10"], 1000);
  assert.equal(byMonth["2026-11"], 1000);
  const past12 = expenseMonths(items, "2025-12", "2026-11");
  assert.equal(Object.fromEntries(past12.map((row) => [row.month, row.pendingCents]))["2025-09"], undefined);
  assert.equal(past12[0].month, "2025-12");
  assert.equal(past12.at(-1)?.month, "2026-11");
});

test("janela do gráfico: 12 anteriores, 12 à frente, 24 meses e personalizado", () => {
  const today = "2026-11-16";
  assert.deepEqual(chartWindow(today, "past12"), { from: "2025-12", to: "2026-11" });
  assert.deepEqual(chartWindow(today, "next12"), { from: "2026-11", to: "2027-10" });
  assert.deepEqual(chartWindow(today, "m24"), { from: "2025-12", to: "2027-11" });
  assert.deepEqual(chartWindow(today, "custom", { from: "2025-09", to: "2026-03" }), { from: "2025-09", to: "2026-03" });
  assert.deepEqual(chartWindow(today, "custom", { from: "2026-03", to: "2025-09" }), { from: "2025-09", to: "2026-03" });
});

test("parcela atual de uma compra antiga", () => {
  assert.equal(currentCardInstallment("2025-09-03", 21, "2026-11-17"), 15);
  assert.equal(currentCardInstallment("2025-09-03", 12, "2026-11-17"), 12);
  assert.equal(currentCardInstallment("2026-11-03", 6, "2026-11-17"), 1);
  assert.equal(currentCardInstallment("2026-12-03", 6, "2026-11-17"), 1);
});

test("data da compra a partir da parcela e total a partir das parcelas restantes", () => {
  assert.equal(purchaseDateOf("2026-11-16", null), "2026-11-16");
  assert.equal(purchaseDateOf("2027-01-16", 3), "2026-11-16");
  assert.equal(
    purchaseTotalFromSiblings(
      [
        { installmentNumber: 1, amountCents: 33334 },
        { installmentNumber: 2, amountCents: 33333 },
        { installmentNumber: 3, amountCents: 33333 },
      ],
      3
    ),
    100000
  );
  assert.equal(purchaseTotalFromSiblings([{ installmentNumber: 4, amountCents: 10000 }], 6), 60000);
});

test("plano de parcelas no cartão desloca data e fatura; compra antiga começa da parcela atual", () => {
  const full = planCardInstallments({
    purchaseDate: "2026-11-16",
    totalCents: 100000,
    count: 3,
    start: 1,
    firstInvoice: "2026-12",
  });
  assert.deepEqual(
    full.map((row) => [row.number, row.date, row.invoiceMonth, row.amountCents]),
    [
      [1, "2026-11-16", "2026-12", 33334],
      [2, "2026-12-16", "2027-01", 33333],
      [3, "2027-01-16", "2027-02", 33333],
    ]
  );
  const fromFourth = planCardInstallments({
    purchaseDate: "2026-11-16",
    totalCents: 60000,
    count: 6,
    start: 4,
    firstInvoice: "2026-12",
  });
  assert.deepEqual(
    fromFourth.map((row) => [row.number, row.date, row.invoiceMonth]),
    [
      [4, "2027-02-16", "2027-03"],
      [5, "2027-03-16", "2027-04"],
      [6, "2027-04-16", "2027-05"],
    ]
  );
  const leftover = planCardInstallments({
    purchaseDate: "2025-09-03",
    totalCents: 15435,
    count: 21,
    start: 15,
    firstInvoice: "2025-09",
  });
  assert.equal(leftover.length, 7);
  assert.deepEqual(
    leftover.map((row) => [row.number, row.date, row.invoiceMonth]),
    [
      [15, "2026-11-03", "2026-11"],
      [16, "2026-12-03", "2026-12"],
      [17, "2027-01-03", "2027-01"],
      [18, "2027-02-03", "2027-02"],
      [19, "2027-03-03", "2027-03"],
      [20, "2027-04-03", "2027-04"],
      [21, "2027-05-03", "2027-05"],
    ]
  );
});
