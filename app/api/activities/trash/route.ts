import { ok, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.activity.findMany({
      where: { deletedAt: { not: null } },
      include: { type: true, opportunity: { select: { id: true, name: true } } },
      orderBy: { deletedAt: "desc" },
      take: 100,
    });
    return ok(rows);
  } catch (e) {
    return serverError(e);
  }
}
