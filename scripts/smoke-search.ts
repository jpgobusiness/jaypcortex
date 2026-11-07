import "dotenv/config";
import { searchKnowledge, resolveAgentId } from "../lib/knowledge/search";
import { prisma } from "../lib/prisma";

async function main() {
  const agentId = await resolveAgentId("migracao-aws");
  if (!agentId) throw new Error("agente ausente");
  const hits = await searchKnowledge({
    query: "como maximizar funding do MAP",
    agentId,
    topK: 8,
  });
  console.log(JSON.stringify(hits.map((h) => ({ title: h.title, score: h.score, heading: h.headingPath })), null, 2));
  if (!hits.some((h) => /funding|incentivo|ACE|maximizar/i.test(h.title + h.content))) {
    throw new Error("busca não retornou docs 5/6");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
