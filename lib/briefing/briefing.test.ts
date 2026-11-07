import assert from "node:assert/strict";
import { test } from "node:test";
import { computeFreeSlots, overlapMinutes, placeTasksInSlots } from "./slots";

test("overlapMinutes", () => {
  const a0 = new Date("2026-11-11T12:00:00.000Z");
  const a1 = new Date("2026-11-11T14:00:00.000Z");
  const b0 = new Date("2026-11-11T13:00:00.000Z");
  const b1 = new Date("2026-11-11T15:00:00.000Z");
  assert.equal(overlapMinutes(a0, a1, b0, b1), 60);
});

test("planDay não sobrepõe busy_blocks", () => {
  const windowStart = new Date("2026-11-11T12:00:00.000Z");
  const windowEnd = new Date("2026-11-11T21:00:00.000Z");
  const busy = [{ start: new Date("2026-11-11T13:00:00.000Z"), end: new Date("2026-11-11T14:00:00.000Z") }];
  const free = computeFreeSlots(windowStart, windowEnd, busy);
  assert.equal(free.length, 2);
  const plan = placeTasksInSlots(free, [
    { id: "a", title: "Tarefa A", minutes: 30 },
    { id: "b", title: "Tarefa B", minutes: 30 },
  ], windowEnd);
  for (const p of plan) {
    const start = new Date(p.start).getTime();
    const end = new Date(p.end).getTime();
    assert.ok(end <= busy[0].start.getTime() || start >= busy[0].end.getTime());
  }
  assert.ok(plan.length >= 2);
});

test("energia alta prefere manhã", () => {
  const windowStart = new Date("2026-11-11T12:00:00.000Z"); // 09:00 SP
  const windowEnd = new Date("2026-11-11T21:00:00.000Z");
  const free = computeFreeSlots(windowStart, windowEnd, []);
  const plan = placeTasksInSlots(free, [
    { id: "tarde", title: "Baixa", minutes: 30, energy: "baixa" },
    { id: "frog", title: "Alta", minutes: 30, energy: "alta" },
  ], windowEnd);
  assert.equal(plan[0]?.activityId, "frog");
});
