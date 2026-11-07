import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isRedirectUriAllowed,
  matchUriPattern,
  mergeClientCredentials,
  normalizeGrantType,
  parseBasicAuth,
  parseFormBody,
  parseJsonBody,
  pkceChallengeS256,
  randomAlphanumeric,
  resolveScopes,
  splitScopes,
  timingSafeEqualStr,
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

test("parseFormBody lê grant_type, resource e ignora params desconhecidos", () => {
  const body = parseFormBody(
    "grant_type=client_credentials&client_id=c1&client_secret=s1&scope=read+write&resource=https://x&audience=mcp&foo=bar"
  );
  assert.equal(body.grant_type, "client_credentials");
  assert.equal(body.client_id, "c1");
  assert.equal(body.client_secret, "s1");
  assert.equal(body.scope, "read write");
  assert.equal(body.resource, "https://x");
  assert.equal(body.audience, "mcp");
  assert.ok(body.keys.includes("foo"));
});

test("parseJsonBody lê o mesmo contrato", () => {
  const body = parseJsonBody({
    grant_type: "client_credentials",
    client_id: "c1",
    client_secret: "s1",
    scope: "read",
    resource: "https://jaypcortex.vercel.app/api/mcp",
  });
  assert.equal(body.grant_type, "client_credentials");
  assert.equal(body.client_id, "c1");
  assert.equal(body.scope, "read");
  assert.equal(body.resource, "https://jaypcortex.vercel.app/api/mcp");
});

test("Basic auth vence o corpo", () => {
  const merged = mergeClientCredentials(
    { grant_type: "client_credentials", client_id: "body", client_secret: "body-secret", keys: [] },
    `Basic ${Buffer.from("hdr:hdr-secret").toString("base64")}`
  );
  assert.equal(merged.client_id, "hdr");
  assert.equal(merged.client_secret, "hdr-secret");
  assert.equal(merged.grant_type, "client_credentials");
});

test("resolveScopes usa os do cliente se o pedido vier vazio", () => {
  const ok = resolveScopes(undefined, ["read", "propose", "write"]);
  assert.deepEqual(ok.scopes, ["read", "propose", "write"]);
});

test("resolveScopes ignora escopo fora da allowlist em vez de falhar", () => {
  const got = resolveScopes("read admin openid", ["read", "propose"]);
  assert.deepEqual(got.scopes, ["read"]);
  assert.deepEqual(got.dropped, ["admin", "openid"]);
});

test("splitScopes aceita espaço e vírgula", () => {
  assert.deepEqual(splitScopes("read, propose write"), ["read", "propose", "write"]);
});

test("normalizeGrantType trata grant omitido como client_credentials", () => {
  assert.equal(normalizeGrantType(undefined, { keys: [] }), "client_credentials");
  assert.equal(normalizeGrantType("", { code: "x", keys: [] }), "authorization_code");
  assert.equal(normalizeGrantType("urn:ietf:params:oauth:grant-type:token-exchange", { keys: [] }).includes("token"), true);
});

test("PKCE S256 é estável e timing-safe", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = pkceChallengeS256(verifier);
  assert.equal(challenge, pkceChallengeS256(verifier));
  assert.equal(timingSafeEqualStr(challenge, pkceChallengeS256(verifier)), true);
  assert.equal(timingSafeEqualStr(challenge, "abc"), false);
});

test("randomAlphanumeric só A-Za-z0-9 no tamanho pedido", () => {
  const id = randomAlphanumeric(24);
  const secret = randomAlphanumeric(40);
  assert.equal(id.length, 24);
  assert.equal(secret.length, 40);
  assert.match(id, /^[A-Za-z0-9]+$/);
  assert.match(secret, /^[A-Za-z0-9]+$/);
});

test("redirect URI allowlist QuickSight", () => {
  assert.equal(matchUriPattern("https://us-east-1.quicksight.aws.amazon.com/oauth/cb", "https://*.quicksight.aws.amazon.com/*"), true);
  const ok = isRedirectUriAllowed("https://sa-east-1.quicksight.aws.amazon.com/foo", []);
  assert.equal(ok.ok, true);
  const bad = isRedirectUriAllowed("https://evil.example/cb", []);
  assert.equal(ok.ok && !("reason" in ok), true);
  assert.equal(bad.ok, false);
});

test("redirect URI ChatGPT connector", () => {
  const gpt = isRedirectUriAllowed("https://chatgpt.com/connector_platform_oauth_redirect", []);
  const openai = isRedirectUriAllowed("https://chat.openai.com/connector_platform_oauth_redirect", []);
  assert.equal(gpt.ok, true);
  assert.equal(openai.ok, true);
});
