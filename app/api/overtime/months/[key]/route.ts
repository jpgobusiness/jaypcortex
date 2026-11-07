import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, num } from "@/lib/api";
import { ensureMonth, isValidMonthKey } from "@/lib/overtime";

type Ctx = { params: Promise<{ key: string }> };

// Garante o mês e retorna o detalhe com registros + metadados dos anexos.
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { key } = await params;
    if (!isValidMonthKey(key)) return badRequest("Mês inválido (use YYYY-MM)");

    const base = await ensureMonth(key);
    const month = await prisma.overtimeMonth.findUnique({
      where: { id: base.id },
      include: {
        entries: {
          orderBy: { date: "desc" },
          include: {
            attachments: {
              select: {
                id: true,
                name: true,
                mimeType: true,
                size: true,
                createdAt: true,
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
    if (!month) return badRequest("Falha ao carregar o mês");

    const totalHours = month.entries.reduce((s, e) => s + e.hours, 0);
    return ok({
      id: month.id,
      monthKey: month.monthKey,
      hourlyRate: month.hourlyRate,
      goalHours: month.goalHours,
      totalHours,
      totalValue: totalHours * month.hourlyRate,
      entries: month.entries,
    });
  } catch (e) {
    return serverError(e);
  }
}

// Atualiza valor-hora e/ou meta do mês.
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { key } = await params;
    if (!isValidMonthKey(key)) return badRequest("Mês inválido (use YYYY-MM)");
    await ensureMonth(key);

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.hourlyRate !== undefined) data.hourlyRate = num(body.hourlyRate) ?? 0;
    if (body.goalHours !== undefined) data.goalHours = num(body.goalHours) ?? 0;

    const month = await prisma.overtimeMonth.update({
      where: { monthKey: key },
      data,
    });
    return ok(month);
  } catch (e) {
    return serverError(e);
  }
}
