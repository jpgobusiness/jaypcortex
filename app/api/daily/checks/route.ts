import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound, serverError, str } from "@/lib/api";
import { dateFromYmd, dayScore, ymdFromDate } from "@/lib/daily";

/** Toggle / set de um checkbox de hábito em um dia. */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const dateStr = str(body.date);
    const habitId = str(body.habitId);
    if (!dateStr || !habitId) {
      return badRequest("date e habitId são obrigatórios");
    }
    if (typeof body.done !== "boolean") {
      return badRequest("done deve ser boolean");
    }

    const habit = await prisma.dailyHabit.findUnique({ where: { id: habitId } });
    if (!habit) return notFound("Hábito não encontrado");

    const date = dateFromYmd(dateStr);
    let day = await prisma.dailyDay.findUnique({ where: { date } });
    if (!day) {
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      day = await prisma.dailyDay.create({
        data: {
          date,
          day: date.getUTCDate(),
          monthKey,
        },
      });
    }

    const check = await prisma.dailyHabitCheck.upsert({
      where: {
        dayId_habitId: { dayId: day.id, habitId },
      },
      create: { dayId: day.id, habitId, done: body.done },
      update: { done: body.done },
    });

    const activeHabits = await prisma.dailyHabit.findMany({
      where: { active: true },
    });
    const checks = await prisma.dailyHabitCheck.findMany({
      where: { dayId: day.id },
    });
    const score = dayScore(activeHabits, checks);

    return ok({
      check,
      day: {
        id: day.id,
        date: ymdFromDate(day.date),
        day: day.day,
        score,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
