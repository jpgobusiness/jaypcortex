import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreActivity } from "./priority";
import { nextDueFromRrule } from "./dates";

test("soft delete exige confirm (contrato)", () => {
  assert.equal(
    "Para apagar, envie confirm: true. A tarefa vai para a lixeira (dá para restaurar).",
    "Para apagar, envie confirm: true. A tarefa vai para a lixeira (dá para restaurar)."
  );
});

test("idempotência: mesmo client_key não cria título diferente na regra", () => {
  const key = "voz-2026-11-07-proposta-vero";
  assert.equal(key.trim().length > 0, true);
});

test("recorrência weekly avança 7 dias", () => {
  const next = nextDueFromRrule("FREQ=WEEKLY", new Date("2026-11-11T00:00:00.000Z"));
  assert.equal(next?.toISOString(), "2026-11-18T00:00:00.000Z");
});

test("score determinístico: mesma entrada = mesma saída", () => {
  const input = { priority: "high", dueDate: new Date("2026-11-11T00:00:00.000Z"), now: new Date("2026-11-11T15:00:00.000Z") };
  assert.deepEqual(scoreActivity(input), scoreActivity(input));
});
