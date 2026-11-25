import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { jsonSchemaTypeIssues } from "./activity-schemas";
import { bindFinanceTools, type FinanceToolApi } from "./finance-tools";
import type { ToolServer } from "./annotations";

function harness(scopes: string[]) {
  const tools = new Map<string, { description: string; schema: z.ZodType; handler: (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }> }>();
  const calls: { name: string; args: unknown[] }[] = [];
  const api: FinanceToolApi = {
    listExpenses: async (opts) => {
      calls.push({ name: "list", args: [opts] });
      return { items: [], totals: {} };
    },
    getExpense: async (ref) => ({ id: ref.id || "e1" }),
    searchExpenses: async (q) => {
      calls.push({ name: "search", args: [q] });
      return { exists: false, items: [] };
    },
    report: async (opts) => {
      calls.push({ name: "report", args: [opts] });
      return { totals: {} };
    },
    snapshot: async (month) => ({ month }),
    bills: async (month) => ({ month }),
    options: async () => ({ accounts: [] }),
    recurrences: async () => [],
    loans: async () => ({ loans: [] }),
    analytics: async () => ({ months: [] }),
    createExpense: async (input) => {
      calls.push({ name: "create", args: [input] });
      return { created: true, ...input };
    },
    createRecurring: async (input) => {
      calls.push({ name: "recurring", args: [input] });
      return { created: true, ...input };
    },
    createCard: async (input) => ({ created: true, ...input }),
    createHousing: async (input) => ({ created: true, ...input }),
    updateExpense: async (ref, patch) => ({ id: ref.id, ...patch }),
    payExpense: async (ref, paid, date) => {
      calls.push({ name: "pay", args: [ref, paid, date] });
      return { id: ref.id, paid };
    },
    deleteExpense: async (ref, scope) => {
      calls.push({ name: "delete", args: [ref, scope] });
      return { deleted: true, id: ref.id, scope };
    },
    createIncome: async (input) => input,
    createTransfer: async (input) => input,
    payInvoice: async (input) => input,
  };
  const server: ToolServer = {
    registerTool(name, config, handler) {
      tools.set(name, { description: config.description, schema: config.inputSchema as z.ZodType, handler });
    },
  };
  bindFinanceTools(server, { scopes }, api);
  return { tools, calls };
}

function payload(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

test("tools de finanças são string, curtas e em português", () => {
  const { tools } = harness(["read", "write"]);
  assert.ok(tools.has("list_expenses"));
  assert.ok(tools.has("pay_expense"));
  assert.ok(tools.has("delete_expense"));
  assert.ok(tools.has("expense_report"));
  for (const [name, tool] of tools) {
    assert.match(tool.description, /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]|despesa|conta|fatura|reais/i, name);
    const schema = z.toJSONSchema(tool.schema) as { properties?: Record<string, { type?: unknown }> };
    assert.deepEqual(jsonSchemaTypeIssues(schema), [], name);
    const fields = Object.entries(schema.properties || {});
    assert.ok(fields.length <= 8, `${name} tem ${fields.length} campos`);
    for (const [field, spec] of fields) assert.equal(spec.type, "string", `${name}.${field}`);
  }
  assert.match(tools.get("pay_expense")!.description, /Não debita/);
  assert.match(tools.get("delete_expense")!.description, /confirm=true/);
  assert.match(tools.get("expense_report")!.description, /dashboard|gráfico/i);
});

test("criar despesa converte 89,90 e leitura não grava", async () => {
  const denied = harness(["read"]);
  const blocked = payload(await denied.tools.get("create_expense")!.handler({
    description: "Padaria",
    amount: "89,90",
  }));
  assert.match(String(blocked.error), /permissão/);
  assert.equal(denied.calls.length, 0);

  const { tools, calls } = harness(["write"]);
  const created = payload(await tools.get("create_expense")!.handler({
    description: "Padaria",
    amount: "89,90",
    date: "2026-11-25",
    account: "Nubank",
    paid: "false",
  }));
  assert.equal(created.amountCents, 8990);
  assert.equal(created.date, "2026-11-25");
  assert.equal(created.paid, false);
  assert.equal(calls[0].name, "create");
});

test("apagar despesa exige confirm e pagar não apaga", async () => {
  const { tools, calls } = harness(["write"]);
  const blocked = payload(await tools.get("delete_expense")!.handler({ query: "netflix" }));
  assert.match(String(blocked.error), /confirm=true/);
  assert.equal(calls.some((call) => call.name === "delete"), false);

  const removed = payload(await tools.get("delete_expense")!.handler({
    id: "e1",
    confirm: "true",
    scope: "future",
  }));
  assert.equal(removed.deleted, true);
  assert.equal(removed.scope, "future");

  const paid = payload(await tools.get("pay_expense")!.handler({ id: "e1", paid: "false" }));
  assert.equal(paid.paid, false);
  assert.equal(calls.some((call) => call.name === "pay"), true);
});

test("recorrente sem fim e listagem do mês", async () => {
  const { tools, calls } = harness(["read", "write"]);
  const listed = payload(await tools.get("list_expenses")!.handler({ month: "novembro 2026", status: "atrasada" }));
  assert.equal((listed.totals as object) && calls[0].name, "list");
  assert.equal((calls[0].args[0] as { month: string }).month, "2026-11");
  assert.equal((calls[0].args[0] as { status: string }).status, "overdue");

  const rule = payload(await tools.get("create_recurring_expense")!.handler({
    description: "Netflix",
    amount: "55,90",
    card: "Nubank",
    start_date: "2026-11-10",
  }));
  assert.equal(rule.amountCents, 5590);
  assert.equal(rule.dayOfMonth, 10);
  assert.equal(rule.intervalMonths, 1);
  assert.equal(rule.endDate, undefined);
});
