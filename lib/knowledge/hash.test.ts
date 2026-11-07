import assert from "node:assert/strict";
import { test } from "node:test";
import { contentHash, sha256, timingSafeEqualHex } from "./hash";

test("contentHash muda com título ou conteúdo", () => {
  const a = contentHash('{"type":"doc"}', "A");
  const b = contentHash('{"type":"doc"}', "B");
  const c = contentHash('{"type":"doc","x":1}', "A");
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.equal(contentHash("x", "t"), contentHash("x", "t"));
});

test("sha256 é estável", () => {
  assert.equal(sha256("abc"), sha256("abc"));
  assert.equal(sha256("abc").length, 64);
});

test("timingSafeEqualHex", () => {
  const h = sha256("token");
  assert.equal(timingSafeEqualHex(h, h), true);
  assert.equal(timingSafeEqualHex(h, sha256("outro")), false);
  assert.equal(timingSafeEqualHex("aa", "aabb"), false);
});
