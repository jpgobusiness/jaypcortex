/**
 * Cria (ou rotaciona o secret) do cliente OAuth amazon-quick.
 * Credenciais em claro só em docs/.mcp-oauth-amazon-quick.local (gitignored).
 */
import "dotenv/config";
import { existsSync, writeFileSync } from "node:fs";
import { prisma } from "../lib/prisma";
import { hashToken } from "../lib/mcp/tokens";
import { generateClientId, generateClientSecret } from "../lib/mcp/oauth";

const NAME = "amazon-quick";
const FILE = "docs/.mcp-oauth-amazon-quick.local";
const SCOPES = ["read", "propose", "write"];
const ORIGIN = (process.env.MCP_PUBLIC_ORIGIN || "https://jaypcortex.vercel.app").replace(/\/$/, "");

async function main() {
  const rotate = process.argv.includes("--rotate");
  const fileExists = existsSync(FILE);
  const existing = await prisma.mcpOAuthClient.findFirst({
    where: { name: NAME, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (existing && fileExists && !rotate) {
    console.log(`Cliente ${NAME} já existe (${existing.clientId}). Credenciais em ${FILE}. Use --rotate para novo secret.`);
    return;
  }

  const secret = generateClientSecret();
  const secretHash = hashToken(secret);
  let clientId = existing?.clientId ?? generateClientId();

  if (existing) {
    await prisma.mcpOAuthClient.update({
      where: { id: existing.id },
      data: { clientSecretHash: secretHash, scopes: SCOPES },
    });
    await prisma.mcpOAuthAccessToken.deleteMany({ where: { clientId: existing.clientId } });
    clientId = existing.clientId;
  } else {
    await prisma.mcpOAuthClient.create({
      data: {
        name: NAME,
        clientId,
        clientSecretHash: secretHash,
        scopes: SCOPES,
      },
    });
  }

  const body = [
    `# OAuth MCP amazon-quick — NÃO versionar`,
    `criado: ${new Date().toISOString()}`,
    `name: ${NAME}`,
    `scopes: ${SCOPES.join(",")}`,
    `client_id: ${clientId}`,
    `client_secret: ${secret}`,
    `token_url: ${ORIGIN}/api/mcp/oauth/token`,
    `mcp_url: ${ORIGIN}/api/mcp`,
    `well_known: ${ORIGIN}/.well-known/oauth-authorization-server`,
    "",
  ].join("\n");
  writeFileSync(FILE, body, { mode: 0o600 });
  console.log(`Cliente gravado em ${FILE} (client_id ${clientId})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
