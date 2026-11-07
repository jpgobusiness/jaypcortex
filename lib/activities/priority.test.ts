import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreActivity } from "./priority";

const now = new Date("2026-11-11T15:00:00.000Z");

test("score urgente + atrasada + fila #1", () => {
  const { score, reasons } = scoreActivity({
    priority: "urgent",
    dueDate: new Date("2026-11-09T00:00:00.000Z"),
    queueOrder: 1,
    now,
  });
  assert.equal(score, 40 + 30 + 9);
  assert.ok(reasons.includes("urgente"));
  assert.ok(reasons.some((r) => r.startsWith("atrasada")));
  assert.ok(reasons.includes("#1 da fila"));
});

test("vence hoje + importância", () => {
  const { score, reasons } = scoreActivity({
    priority: "normal",
    importance: 4,
    dueDate: new Date("2026-11-11T00:00:00.000Z"),
    now,
  });
  assert.equal(score, 15 + 20 + 25);
  assert.ok(reasons.includes("vence hoje"));
  assert.ok(reasons.includes("importante"));
});

test("aguardando reduz score; em andamento aumenta", () => {
  const waiting = scoreActivity({ priority: "high", waitingOn: "cliente", now });
  const running = scoreActivity({ priority: "high", statusIsInProgress: true, now });
  assert.equal(waiting.score, 15);
  assert.equal(running.score, 40);
  assert.ok(waiting.reasons.some((r) => r.includes("aguardando")));
});
