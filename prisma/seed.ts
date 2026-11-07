import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

// Estágios padrão do pipeline (o usuário pode editar depois em Configurações).
const STAGES = [
  { name: "Qualifying", order: 1, color: "#64748b", probability: 10 },
  { name: "Technical Validation", order: 2, color: "#0ea5e9", probability: 25 },
  { name: "Business Validation", order: 3, color: "#6366f1", probability: 40 },
  { name: "Committed", order: 4, color: "#8b5cf6", probability: 60 },
  { name: "Commit Pending", order: 5, color: "#f59e0b", probability: 70 },
  { name: "Pending Signature", order: 6, color: "#f97316", probability: 85 },
  { name: "Launched", order: 7, color: "#14b8a6", probability: 95 },
  { name: "Closed", order: 8, color: "#22c55e", probability: 100, isWon: true },
  { name: "Lost", order: 9, color: "#ef4444", probability: 0, isLost: true },
];

// Tipos de atividade padrão (configuráveis).
const ACTIVITY_TYPES = [
  { name: "Criar Doc", color: "#6366f1" },
  { name: "Criar Proposta", color: "#0ea5e9" },
  { name: "Criar Calculadora", color: "#8b5cf6" },
  { name: "Reunião", color: "#f59e0b" },
  { name: "Follow-up", color: "#22c55e" },
];

// Status de atividade padrão (configuráveis). A key é referenciada por Activity.status.
const ACTIVITY_STATUSES = [
  { key: "pending", name: "Pendente", color: "#94a3b8", order: 1, isDone: false },
  { key: "in_progress", name: "Em andamento", color: "#0ea5e9", order: 2, isDone: false },
  { key: "done", name: "Concluída", color: "#22c55e", order: 3, isDone: true },
];

// Comerciais padrão (configuráveis em Configurações).
const COMMERCIALS = [
  { name: "Alessandra Palma", color: "#e11d48" },
  { name: "Vitor Bragantini", color: "#0ea5e9" },
  { name: "Bruna Dornelas", color: "#8b5cf6" },
  { name: "Vinicius Felix", color: "#f59e0b" },
  { name: "Bruno Teles", color: "#14b8a6" },
  { name: "Victor Lisboa", color: "#6366f1" },
  { name: "Eduarda Iansen", color: "#ec4899" },
  { name: "Nicole Cristen", color: "#22c55e" },
  { name: "Wendell Ferraz", color: "#f97316" },
];

// Metas por quarter (valor do quarter, não acumulado). Acumulado é calculado na app.
// Ano corrente como padrão.
const GOAL_YEAR = new Date().getFullYear();
const QUARTER_TARGETS = [
  { quarter: "Q1", target: 1_360_800 },
  { quarter: "Q2", target: 1_814_400 },
  { quarter: "Q3", target: 2_721_600 },
  { quarter: "Q4", target: 3_175_200 },
];

async function main() {
  // Estágios: só cria se ainda não houver nenhum.
  const stageCount = await prisma.stage.count();
  if (stageCount === 0) {
    for (const stage of STAGES) {
      await prisma.stage.create({ data: stage });
    }
    console.log(`✓ ${STAGES.length} estágios criados`);
  } else {
    console.log(`• Estágios já existem (${stageCount}), pulando`);
  }

  // Tipos de atividade: só cria se não houver nenhum.
  const typeCount = await prisma.activityType.count();
  if (typeCount === 0) {
    for (const t of ACTIVITY_TYPES) {
      await prisma.activityType.create({ data: t });
    }
    console.log(`✓ ${ACTIVITY_TYPES.length} tipos de atividade criados`);
  } else {
    console.log(`• Tipos de atividade já existem (${typeCount}), pulando`);
  }

  // Status de atividade: cria os padrões por key (idempotente).
  for (const s of ACTIVITY_STATUSES) {
    await prisma.activityStatus.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log(`✓ Status de atividade (${ACTIVITY_STATUSES.length}) garantidos`);

  // Comerciais: só cria se não houver nenhum.
  const commercialCount = await prisma.commercial.count();
  if (commercialCount === 0) {
    for (const c of COMMERCIALS) {
      await prisma.commercial.create({ data: c });
    }
    console.log(`✓ ${COMMERCIALS.length} comerciais criados`);
  } else {
    console.log(`• Comerciais já existem (${commercialCount}), pulando`);
  }

  // Metas por quarter: upsert idempotente por (ano, quarter).
  for (const g of QUARTER_TARGETS) {
    await prisma.quarterGoal.upsert({
      where: { year_quarter: { year: GOAL_YEAR, quarter: g.quarter } },
      update: { target: g.target },
      create: { year: GOAL_YEAR, quarter: g.quarter, target: g.target },
    });
  }
  console.log(`✓ Metas ${GOAL_YEAR} (Q1-Q4) configuradas`);

  // Hábitos do Controle Diário: só cria se não houver nenhum.
  const { DEFAULT_DAILY_HABITS } = await import("../lib/daily");
  const habitCount = await prisma.dailyHabit.count();
  if (habitCount === 0) {
    for (let i = 0; i < DEFAULT_DAILY_HABITS.length; i++) {
      await prisma.dailyHabit.create({
        data: {
          name: DEFAULT_DAILY_HABITS[i],
          order: i + 1,
          active: true,
        },
      });
    }
    console.log(`✓ ${DEFAULT_DAILY_HABITS.length} hábitos diários criados`);
  } else {
    console.log(`• Hábitos diários já existem (${habitCount}), pulando`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
