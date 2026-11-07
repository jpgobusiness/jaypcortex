import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError } from "@/lib/api";
import { ensureDefaultHabits } from "@/lib/daily-db";
import {
  parseMonthKey,
  daysInMonth,
  dayScore,
  ymdFromDate,
} from "@/lib/daily";

type Ctx = { params: Promise<{ key: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { key } = await ctx.params;
    const parsed = parseMonthKey(key);
    if (!parsed) return badRequest("monthKey inválido (use YYYY-MM)");

    await ensureDefaultHabits();

    const { year, month } = parsed;
    const totalDays = daysInMonth(year, month);

    const existing = await prisma.dailyDay.findMany({
      where: { monthKey: key },
    });
    const have = new Set(existing.map((d) => d.day));
    for (let day = 1; day <= totalDays; day++) {
      if (have.has(day)) continue;
      const date = new Date(Date.UTC(year, month - 1, day));
      await prisma.dailyDay.create({
        data: { date, day, monthKey: key },
      });
    }

    const habits = await prisma.dailyHabit.findMany({
      where: { active: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    const allHabits = await prisma.dailyHabit.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    const days = await prisma.dailyDay.findMany({
      where: { monthKey: key },
      include: { checks: true },
      orderBy: { day: "asc" },
    });

    const todayYmd = ymdFromDate(
      new Date(
        Date.UTC(
          new Date().getFullYear(),
          new Date().getMonth(),
          new Date().getDate()
        )
      )
    );

    const daysPayload = days.map((d) => {
      const ymd = ymdFromDate(d.date);
      const score = dayScore(habits, d.checks);
      const isFuture = ymd > todayYmd;
      return {
        id: d.id,
        day: d.day,
        date: ymd,
        monthKey: d.monthKey,
        checks: Object.fromEntries(d.checks.map((c) => [c.habitId, c.done])),
        score: isFuture ? null : score,
        isFuture,
      };
    });

    const scored = daysPayload.filter((d) => d.score !== null);
    const avgCompletion =
      scored.length === 0
        ? 0
        : scored.reduce((s, d) => s + (d.score ?? 0), 0) / scored.length;
    const perfectDays = scored.filter((d) => (d.score ?? 0) >= 100).length;

    return ok({
      monthKey: key,
      habits: allHabits,
      activeHabits: habits,
      days: daysPayload,
      metrics: {
        avgCompletion,
        perfectDays,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
