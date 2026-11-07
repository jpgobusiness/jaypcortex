import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, num } from "@/lib/api";
import {
  parseMonthKey,
  daysInMonth,
  ymdFromDate,
} from "@/lib/daily";

type Ctx = { params: Promise<{ key: string }> };

const DEFAULT_GOAL_SCORE = 70;

async function ensureChallengeMonth(monthKey: string) {
  return prisma.challengeMonth.upsert({
    where: { monthKey },
    create: { monthKey, goalScore: DEFAULT_GOAL_SCORE },
    update: {},
  });
}

/** Lista (e garante) todos os dias civis do mês: 01 … 28/29/30/31. */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { key } = await ctx.params;
    const parsed = parseMonthKey(key);
    if (!parsed) return badRequest("monthKey inválido (use YYYY-MM)");

    const year = parsed.year;
    const monthIndex = parsed.month;
    const totalDays = daysInMonth(year, monthIndex);

    await prisma.challengeDay.deleteMany({
      where: {
        monthKey: key,
        day: { gt: totalDays },
      },
    });

    const existing = await prisma.challengeDay.findMany({
      where: { monthKey: key },
    });
    const byDay = new Map(existing.map((d) => [d.day, d]));

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(Date.UTC(year, monthIndex - 1, day));
      const row = byDay.get(day);
      if (!row) {
        await prisma.challengeDay.create({
          data: { monthKey: key, day, date },
        });
        continue;
      }
      const expected = ymdFromDate(date);
      const actual = ymdFromDate(row.date);
      if (actual !== expected) {
        await prisma.challengeDay.update({
          where: { id: row.id },
          data: { date },
        });
      }
    }

    const days = await prisma.challengeDay.findMany({
      where: { monthKey: key },
      orderBy: { day: "asc" },
      include: { checks: true },
    });

    const items = await prisma.challengeItem.findMany({
      orderBy: { order: "asc" },
    });

    const monthConfig = await ensureChallengeMonth(key);

    return ok({
      monthKey: key,
      goalScore: monthConfig.goalScore,
      items,
      days: days.map((d) => ({
        id: d.id,
        monthKey: d.monthKey,
        day: d.day,
        date: ymdFromDate(d.date),
        checks: d.checks
          .filter((c) => c.checked)
          .map((c) => c.itemId),
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}

/** Atualiza meta de nota do mês. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { key } = await ctx.params;
    const parsed = parseMonthKey(key);
    if (!parsed) return badRequest("monthKey inválido (use YYYY-MM)");

    await ensureChallengeMonth(key);

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.goalScore !== undefined) {
      const goal = num(body.goalScore) ?? DEFAULT_GOAL_SCORE;
      data.goalScore = Math.min(100, Math.max(0, goal));
    }

    const monthConfig = await prisma.challengeMonth.update({
      where: { monthKey: key },
      data,
    });

    return ok(monthConfig);
  } catch (e) {
    return serverError(e);
  }
}
