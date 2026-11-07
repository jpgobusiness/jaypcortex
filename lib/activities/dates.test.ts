import assert from "node:assert/strict";
import { test } from "node:test";
import { nextDueFromRrule, parseDatePhrase } from "./dates";

const noonSP = new Date("2026-11-11T15:00:00.000Z"); // 12:00 em São Paulo (UTC-3)

test("parse hoje/amanhã/ontem no fuso SP", () => {
  const hoje = parseDatePhrase("hoje", noonSP);
  const amanha = parseDatePhrase("amanhã", noonSP);
  const ontem = parseDatePhrase("ontem", noonSP);
  assert.equal(hoje?.interpreted_as, "hoje");
  assert.equal(hoje?.date.toISOString(), "2026-11-11T00:00:00.000Z");
  assert.equal(amanha?.interpreted_as, "amanhã");
  assert.equal(amanha?.date.toISOString(), "2026-11-12T00:00:00.000Z");
  assert.equal(ontem?.date.toISOString(), "2026-11-10T00:00:00.000Z");
});

test("parse sexta = próxima ocorrência futura", () => {
  const sexta = parseDatePhrase("sexta", noonSP);
  assert.ok(sexta);
  assert.equal(sexta.date.toISOString(), "2026-11-13T00:00:00.000Z");
});

test("parse dia 15 e próxima semana", () => {
  const dia = parseDatePhrase("dia 15", noonSP);
  assert.equal(dia?.date.toISOString(), "2026-11-15T00:00:00.000Z");
  const sem = parseDatePhrase("próxima semana", noonSP);
  assert.ok(sem);
  assert.equal(sem.date.getUTCDay(), 1);
  assert.equal(sem.date.toISOString(), "2026-11-16T00:00:00.000Z");
});

test("parse ISO e data BR", () => {
  const iso = parseDatePhrase("2026-12-01", noonSP);
  assert.equal(iso?.date.toISOString(), "2026-12-01T00:00:00.000Z");
  const br = parseDatePhrase("01/12/2026", noonSP);
  assert.equal(br?.date.toISOString(), "2026-12-01T00:00:00.000Z");
});

test("RRULE daily/weekly/monthly", () => {
  const from = new Date("2026-11-11T00:00:00.000Z");
  assert.equal(nextDueFromRrule("FREQ=DAILY", from)?.toISOString(), "2026-11-12T00:00:00.000Z");
  assert.equal(nextDueFromRrule("FREQ=WEEKLY;BYDAY=WE", from)?.toISOString(), "2026-11-18T00:00:00.000Z");
  assert.equal(nextDueFromRrule("FREQ=MONTHLY", from)?.toISOString(), "2026-12-11T00:00:00.000Z");
  assert.equal(nextDueFromRrule("FREQ=YEARLY", from), null);
});
