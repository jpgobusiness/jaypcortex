/**
 * Seed idempotente do espaço Oportunidades + pasta _Templates
 * (Proposal Doc padrão e Contexto da oportunidade em TipTap).
 *
 * Uso: npm run seed:opportunities
 */
import "dotenv/config";
import { seedOpportunitiesWorkspace } from "../lib/opportunities/service";

async function main() {
  const result = await seedOpportunitiesWorkspace();
  console.log("espaço Oportunidades ok", result);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
