import { prisma } from "@/lib/prisma";

/** Valida o formato "YYYY-MM". */
export function isValidMonthKey(key: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
}

/**
 * Garante que o mês existe. Se não existir, cria herdando valor-hora e meta
 * do mês mais recente já cadastrado (ou 0).
 */
export async function ensureMonth(monthKey: string) {
  const existing = await prisma.overtimeMonth.findUnique({
    where: { monthKey },
  });
  if (existing) return existing;

  const latest = await prisma.overtimeMonth.findFirst({
    orderBy: { monthKey: "desc" },
  });

  return prisma.overtimeMonth.create({
    data: {
      monthKey,
      hourlyRate: latest?.hourlyRate ?? 0,
      goalHours: latest?.goalHours ?? 0,
    },
  });
}
