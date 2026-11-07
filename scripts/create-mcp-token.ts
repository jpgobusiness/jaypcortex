/**
 * Cria (ou rotaciona) o token amazon-quick e grava só em
 * docs/.mcp-token-amazon-quick.local (gitignored).
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { prisma } from "../lib/prisma";
import { createMcpToken } from "../lib/mcp/tokens";

const NAME = "amazon-quick";
const FILE = "docs/.mcp-token-amazon-quick.local";
const SCOPES = ["read", "propose", "write"];

async function main() {
  const email = (process.env.ADMIN_EMAIL || "pjoao4446@gmail.com").trim().toLowerCase();
  const profile = await prisma.profile.findFirst({ where: { email } });
  if (!profile) throw new Error(`Profile admin não encontrado: ${email}`);

  const rotate = process.argv.includes("--rotate");
  const existing = await prisma.mcpToken.findFirst({
    where: { name: NAME, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (existing && !rotate) {
    console.log(`Token ${NAME} já existe (id ${existing.id}, prefixo ${existing.prefix}). Use --rotate para gerar outro.`);
    return;
  }
  if (existing && rotate) {
    await prisma.mcpToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  }
  const created = await createMcpToken({
    name: NAME,
    scopes: SCOPES,
    profileId: profile.id,
  });
  const body = [
    `# Token MCP amazon-quick — NÃO versionar`,
    `criado: ${new Date().toISOString()}`,
    `id: ${created.id}`,
    `prefix: ${created.prefix}`,
    `scopes: ${SCOPES.join(",")}`,
    `token: ${created.token}`,
    "",
  ].join("\n");
  writeFileSync(FILE, body, { mode: 0o600 });
  console.log(`Token gravado em ${FILE} (prefixo ${created.prefix})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
