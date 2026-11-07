import { prisma } from "@/lib/prisma";
import { DEFAULT_DAILY_HABITS } from "@/lib/daily";

/** Garante hábitos padrão na primeira carga. */
export async function ensureDefaultHabits() {
  const count = await prisma.dailyHabit.count();
  if (count > 0) return;
  await prisma.dailyHabit.createMany({
    data: DEFAULT_DAILY_HABITS.map((name, i) => ({
      name,
      order: i + 1,
      active: true,
    })),
  });
}
