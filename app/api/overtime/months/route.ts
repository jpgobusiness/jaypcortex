import { prisma } from "@/lib/prisma";
import { ok, serverError } from "@/lib/api";

// Lista todos os meses com totais (para navegação e gráficos comparativos).
export async function GET() {
  try {
    const months = await prisma.overtimeMonth.findMany({
      orderBy: { monthKey: "asc" },
      include: { entries: { select: { hours: true } } },
    });
    return ok(
      months.map((m) => {
        const totalHours = m.entries.reduce((s, e) => s + e.hours, 0);
        return {
          id: m.id,
          monthKey: m.monthKey,
          hourlyRate: m.hourlyRate,
          goalHours: m.goalHours,
          totalHours,
          totalValue: totalHours * m.hourlyRate,
          entryCount: m.entries.length,
        };
      })
    );
  } catch (e) {
    return serverError(e);
  }
}
