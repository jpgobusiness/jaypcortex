import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound, serverError, str } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.dailyHabit.findUnique({ where: { id } });
    if (!existing) return notFound("Hábito não encontrado");

    const body = await req.json();
    const data: { name?: string; order?: number; active?: boolean } = {};

    if (body.name !== undefined) {
      const name = str(body.name);
      if (!name) return badRequest("Nome inválido");
      data.name = name;
    }
    if (body.order !== undefined) {
      const order = Number(body.order);
      if (!Number.isFinite(order)) return badRequest("Ordem inválida");
      data.order = order;
    }
    if (body.active !== undefined) {
      data.active = Boolean(body.active);
    }

    const habit = await prisma.dailyHabit.update({ where: { id }, data });
    return ok(habit);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.dailyHabit.findUnique({ where: { id } });
    if (!existing) return notFound("Hábito não encontrado");
    await prisma.dailyHabit.delete({ where: { id } });
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
