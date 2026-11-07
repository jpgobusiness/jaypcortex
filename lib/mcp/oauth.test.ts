import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mergeClientCredentials,
  parseBasicAuth,
  parseFormBody,
  parseJsonBody,
  resolveScopes,
  splitScopes,
} from "./oauth-parse";

test("parseBasicAuth decodifica client_id:client_secret", () => {
  const header = `Basic ${Buffer.from("abc:s3cret:with:colon").toString("base64")}`;
  const parsed = parseBasicAuth(header);
  assert.deepEqual(parsed, { client_id: "abc", client_secret: "s3cret:with:colon" });
});

test("parseBasicAuth ignora header inválido", () => {
  assert.equal(parseBasicAuth(null), null);
  assert.equal(parseBasicAuth("Bearer xyz"), null);
  assert.equal(parseBasicAuth(`Basic ${Buffer.from("sem-dois-pontos").toString("base64")}`), null);
});

test("parseFormBody lê grant_type e credenciais", () => {
  const body = parseFormBody("grant_type=client_credentials&client_id=c1&client_secret=s1&scope=read+write");
  assert.equal(body.grant_type, "client_credentials");
  assert.equal(body.client_id, "c1");
  assert.equal(body.client_secret, "s1");
  assert.equal(body.scope, "read write");
});

test("parseJsonBody lê o mesmo contrato", () => {
  const body = parseJsonBody({
    grant_type: "client_credentials",
    client_id: "c1",
    client_secret: "s1",
    scope: "read",
  });
  assert.equal(body.grant_type, "client_credentials");
  assert.equal(body.client_id, "c1");
  assert.equal(body.scope, "read");
});

test("Basic auth vence o corpo", () => {
  const merged = mergeClientCredentials(
    { grant_type: "client_credentials", client_id: "body", client_secret: "body-secret" },
    `Basic ${Buffer.from("hdr:hdr-secret").toString("base64")}`
  );
  assert.equal(merged.client_id, "hdr");
  assert.equal(merged.client_secret, "hdr-secret");
  assert.equal(merged.grant_type, "client_credentials");
});

test("resolveScopes usa os do cliente se o pedido vier vazio", () => {
  const ok = resolveScopes(undefined, ["read", "propose", "write"]);
  assert.deepEqual(ok, { scopes: ["read", "propose", "write"] });
});

test("resolveScopes recusa escopo fora da allowlist", () => {
  const bad = resolveScopes("read admin", ["read", "propose"]);
  assert.equal("error" in bad, true);
});

test("splitScopes aceita espaço e vírgula", () => {
  assert.deepEqual(splitScopes("read, propose write"), ["read", "propose", "write"]);
});
