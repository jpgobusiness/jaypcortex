import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound, serverError } from "@/lib/api";
import { parseMonthKey, daysInMonth, ymdFromDate } from "@/lib/daily";

type Ctx = { params: Promise<{ key: string; day: string }> };

/**
 * PATCH: Toggle de checks dinâmicos.
 * Body: { toggleItem: "itemId" } — alterna o check desse item no dia.
 * Ou: { checks: ["itemId1", "itemId2", ...] } — define exatamente quais itens estão marcados.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { key, day: dayStr } = await ctx.params;
    const parsed = parseMonthKey(key);
    if (!parsed) return badRequest("monthKey inválido (use YYYY-MM)");

    const dayNum = Number(dayStr);
    const maxDay = daysInMonth(parsed.year, parsed.month);
    if (!dayNum || dayNum < 1 || dayNum > maxDay) {
      return badRequest(`Dia deve ser entre 1 e ${maxDay}`);
    }

    const date = new Date(Date.UTC(parsed.year, parsed.month - 1, dayNum));

    // Garante que o dia existe
    const dayRecord = await prisma.challengeDay.upsert({
      where: { monthKey_day: { monthKey: key, day: dayNum } },
      create: { monthKey: key, day: dayNum, date },
      update: {},
    });

    const body = await req.json();

    // Modo 1: Toggle de um único item
    if (body.toggleItem) {
      const itemId = String(body.toggleItem);
      const existing = await prisma.challengeDayCheck.findUnique({
        where: { dayId_itemId: { dayId: dayRecord.id, itemId } },
      });

      if (existing) {
        // Estava marcado → remove
        await prisma.challengeDayCheck.delete({
          where: { id: existing.id },
        });
      } else {
        // Não estava → marca
        await prisma.challengeDayCheck.create({
          data: { dayId: dayRecord.id, itemId, checked: true },
        });
      }

      // Retorna o estado atualizado do dia
      const checks = await prisma.challengeDayCheck.findMany({
        where: { dayId: dayRecord.id, checked: true },
      });

      return ok({
        id: dayRecord.id,
        day: dayRecord.day,
        date: ymdFromDate(dayRecord.date),
        checks: checks.map((c) => c.itemId),
      });
    }

    // Modo 2: Set completo dos checks
    if (Array.isArray(body.checks)) {
      const itemIds: string[] = body.checks;

      // Remove todos os checks do dia
      await prisma.challengeDayCheck.deleteMany({
        where: { dayId: dayRecord.id },
      });

      // Cria os novos
      if (itemIds.length > 0) {
        await prisma.challengeDayCheck.createMany({
          data: itemIds.map((itemId) => ({
            dayId: dayRecord.id,
            itemId,
            checked: true,
          })),
        });
      }

      return ok({
        id: dayRecord.id,
        day: dayRecord.day,
        date: ymdFromDate(dayRecord.date),
        checks: itemIds,
      });
    }

    return badRequest("Envie { toggleItem: 'id' } ou { checks: ['id1', ...] }");
  } catch (e) {
    return serverError(e);
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { key, day: dayStr } = await ctx.params;
    const parsed = parseMonthKey(key);
    if (!parsed) return badRequest("monthKey inválido (use YYYY-MM)");

    const dayNum = Number(dayStr);
    const record = await prisma.challengeDay.findUnique({
      where: { monthKey_day: { monthKey: key, day: dayNum } },
      include: { checks: true },
    });
    if (!record) return notFound("Dia não encontrado");

    return ok({
      id: record.id,
      day: record.day,
      date: ymdFromDate(record.date),
      checks: record.checks.filter((c) => c.checked).map((c) => c.itemId),
    });
  } catch (e) {
    return serverError(e);
  }
}
