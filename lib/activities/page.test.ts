import assert from "node:assert/strict";
import { test } from "node:test";
import { activityPageEnvelope } from "./page";

test("página incompleta marca truncated e manda usar total", () => {
  const page = activityPageEnvelope({
    activities: [{ id: "1" }, { id: "2" }],
    total: 12,
    limit: 2,
    status: "open",
    counts: { open: 12, done: 109, in_queue: 12 },
  });
  assert.equal(page.returned, 2);
  assert.equal(page.total, 12);
  assert.equal(page.truncated, true);
  assert.match(page.note, /NÃO diga que estas são todas/i);
  assert.equal(page.counts.open, 12);
});

test("página completa traz panorama, truncated false", () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }));
  const page = activityPageEnvelope({
    activities: items,
    total: 12,
    limit: 20,
    status: "open",
    counts: { open: 12, done: 109, in_queue: 12 },
  });
  assert.equal(page.truncated, false);
  assert.match(page.note, /12 pendentes/);
  assert.match(page.note, /109 concluídas/);
});
