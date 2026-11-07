/**
 * Cria/rotaciona clientes OAuth amazon-quick (client_credentials) e
 * amazon-quick-user (authorization_code). Credenciais só em
 * docs/.mcp-oauth-amazon-quick.local (gitignored).
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { prisma } from "../lib/prisma";
import { hashSha256 } from "../lib/mcp/oauth-parse";
import { generateClientId, generateClientSecret } from "../lib/mcp/oauth";

const FILE = "docs/.mcp-oauth-amazon-quick.local";
const SCOPES = ["read", "propose", "write"];
const ORIGIN = (process.env.MCP_PUBLIC_ORIGIN || "https://jaypcortex.vercel.app").replace(/\/$/, "");

async function rotateClient(opts: {
  name: string;
  grantTypes: string[];
  publicClient: boolean;
}) {
  const existing = await prisma.mcpOAuthClient.findMany({
    where: { name: opts.name, revokedAt: null },
  });
  for (const row of existing) {
    await prisma.mcpOAuthAccessToken.deleteMany({ where: { clientId: row.clientId } });
    await prisma.mcpOAuthClient.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
  }
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();
  const row = await prisma.mcpOAuthClient.create({
    data: {
      name: opts.name,
      clientId,
      clientSecretHash: hashSha256(clientSecret),
      scopes: SCOPES,
      publicClient: opts.publicClient,
      grantTypes: opts.grantTypes,
      redirectUris: [],
    },
  });
  return { row, clientId, clientSecret };
}

async function main() {
  const s2s = await rotateClient({
    name: "amazon-quick",
    grantTypes: ["client_credentials"],
    publicClient: false,
  });
  const user = await rotateClient({
    name: "amazon-quick-user",
    grantTypes: ["authorization_code", "refresh_token"],
    publicClient: false,
  });

  const body = [
    `# OAuth MCP Amazon Quick — NÃO versionar`,
    `criado: ${new Date().toISOString()}`,
    `scopes: ${SCOPES.join(" ")}`,
    `mcp_url: ${ORIGIN}/api/mcp`,
    `token_url: ${ORIGIN}/api/mcp/oauth/token`,
    `authorization_url: ${ORIGIN}/api/mcp/oauth/authorize`,
    `well_known: ${ORIGIN}/.well-known/oauth-authorization-server`,
    ``,
    `# Serviço a serviço (client_credentials) — ID/secret só alfanuméricos`,
    `client_id: ${s2s.clientId}`,
    `client_secret: ${s2s.clientSecret}`,
    ``,
    `# Autenticação do usuário (authorization_code + PKCE S256)`,
    `user_client_id: ${user.clientId}`,
    `user_client_secret: ${user.clientSecret}`,
    `user_public_client: false`,
    ``,
  ].join("\n");
  writeFileSync(FILE, body, { mode: 0o600 });
  console.log(`Clientes gravados em ${FILE}`);
  console.log(`amazon-quick client_id=${s2s.clientId}`);
  console.log(`amazon-quick-user client_id=${user.clientId}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
