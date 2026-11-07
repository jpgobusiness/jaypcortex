/**
 * Seed: cria os ChallengeItems padrão e migra dados existentes das colunas hardcoded
 * para a nova tabela ChallengeDayCheck.
 *
 * Rodar com: npx tsx prisma/seed-challenge-items.ts
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

const DEFAULT_ITEMS = [
  { name: "Água 3L", icon: "droplets", order: 1, field: "water" },
  { name: "Chá", icon: "cup-soda", order: 2, field: "tea" },
  { name: "Café da Manhã", icon: "coffee", order: 3, field: "breakfast" },
  { name: "Almoço", icon: "utensils-crossed", order: 4, field: "lunch" },
  { name: "Lanche", icon: "apple", order: 5, field: "snack" },
  { name: "Jantar", icon: "utensils", order: 6, field: "dinner" },
  { name: "Treino", icon: "dumbbell", order: 7, field: "workoutDone" },
  { name: "Sem Cerveja", icon: "beer-off", order: 8, field: "beerAbstained" },
] as const;

async function main() {
  // 1. Criar itens padrão (idempotente)
  const items: { id: string; field: string }[] = [];

  for (const def of DEFAULT_ITEMS) {
    const existing = await prisma.challengeItem.findFirst({
      where: { name: def.name },
    });
    if (existing) {
      items.push({ id: existing.id, field: def.field });
      console.log(`  ✓ Item já existe: ${def.name}`);
    } else {
      const created = await prisma.challengeItem.create({
        data: { name: def.name, icon: def.icon, order: def.order },
      });
      items.push({ id: created.id, field: def.field });
      console.log(`  + Criado: ${def.name}`);
    }
  }

  // 2. Migrar dados existentes dos dias para ChallengeDayCheck
  const days = await prisma.challengeDay.findMany();
  console.log(`\nMigrando ${days.length} dias...`);

  let checksCreated = 0;
  for (const day of days) {
    for (const item of items) {
      let isChecked = false;
      switch (item.field) {
        case "water":
          isChecked = day.water;
          break;
        case "tea":
          isChecked = day.tea;
          break;
        case "breakfast":
          isChecked = day.breakfast;
          break;
        case "lunch":
          isChecked = day.lunch;
          break;
        case "snack":
          isChecked = day.snack;
          break;
        case "dinner":
          isChecked = day.dinner;
          break;
        case "workoutDone":
          isChecked = day.workoutStatus === "done" || day.workoutStatus === "double";
          break;
        case "beerAbstained":
          isChecked = day.beerAbstained;
          break;
      }

      if (isChecked) {
        await prisma.challengeDayCheck.upsert({
          where: { dayId_itemId: { dayId: day.id, itemId: item.id } },
          create: { dayId: day.id, itemId: item.id, checked: true },
          update: { checked: true },
        });
        checksCreated++;
      }
    }
  }

  console.log(`✓ ${checksCreated} checks criados/atualizados.`);
  console.log("\nMigração concluída!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
