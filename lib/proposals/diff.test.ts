import assert from "node:assert/strict";
import { test } from "node:test";
import { unifiedDiff } from "./diff";
import { contentHash } from "../knowledge/hash";

test("unifiedDiff marca linhas alteradas", () => {
  const diff = unifiedDiff("ola\nmundo", "ola\nMAP", "doc");
  assert.match(diff, /--- a\/doc/);
  assert.match(diff, /-mundo/);
  assert.match(diff, /\+MAP/);
});

test("hash de proposta detecta conflito", () => {
  const base = contentHash('{"type":"doc"}', "t");
  const later = contentHash('{"type":"doc","n":1}', "t");
  assert.notEqual(base, later);
});
