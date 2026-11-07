import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, num, str, dt } from "@/lib/api";
import { ensureMonth, isValidMonthKey } from "@/lib/overtime";

// Cria um registro de hora extra em um mês (cria o mês se necessário).
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const monthKey = str(body.monthKey);
    if (!monthKey || !isValidMonthKey(monthKey)) {
      return badRequest("Mês inválido (use YYYY-MM)");
    }
    const hours = num(body.hours);
    if (hours === null || hours < 0) return badRequest("Horas inválidas");

    const month = await ensureMonth(monthKey);
    const entry = await prisma.overtimeEntry.create({
      data: {
        monthId: month.id,
        date: dt(body.date) ?? new Date(),
        hours,
        description: str(body.description),
        clickupRequested: Boolean(body.clickupRequested),
      },
      include: { attachments: true },
    });
    return ok(entry, 201);
  } catch (e) {
    return serverError(e);
  }
}
