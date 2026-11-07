import assert from "node:assert/strict";
import { test } from "node:test";
import { readMeta, writeMeta } from "./annotations";

test("readMeta marca só leitura", () => {
  const meta = readMeta("Listar tarefas");
  assert.equal(meta.title, "Listar tarefas");
  assert.equal(meta.annotations.readOnlyHint, true);
  assert.equal(meta.annotations.openWorldHint, false);
  assert.equal("destructiveHint" in meta.annotations, false);
});

test("writeMeta destrutiva e idempotente", () => {
  const dest = writeMeta("Lixeira", { destructive: true, idempotent: true });
  assert.equal(dest.annotations.readOnlyHint, false);
  assert.equal(dest.annotations.destructiveHint, true);
  assert.equal(dest.annotations.idempotentHint, true);
  const add = writeMeta("Criar tarefa");
  assert.equal(add.annotations.destructiveHint, false);
  assert.equal(add.annotations.idempotentHint, false);
});
