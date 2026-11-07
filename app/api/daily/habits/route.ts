import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str } from "@/lib/api";
import { ensureDefaultHabits } from "@/lib/daily-db";

export async function GET() {
  try {
    await ensureDefaultHabits();
    const habits = await prisma.dailyHabit.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return ok(habits);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = str(body.name);
    if (!name) return badRequest("Nome do hábito é obrigatório");

    const max = await prisma.dailyHabit.aggregate({ _max: { order: true } });
    const habit = await prisma.dailyHabit.create({
      data: {
        name,
        order: (max._max.order ?? 0) + 1,
        active: true,
      },
    });
    return ok(habit, 201);
  } catch (e) {
    return serverError(e);
  }
}
