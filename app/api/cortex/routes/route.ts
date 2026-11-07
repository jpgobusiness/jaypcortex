import { prisma } from "@/lib/prisma";
import { ok, serverError } from "@/lib/api";

export async function GET() {
  try {
    const rows = await prisma.cortexRouteLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return ok(rows);
  } catch (e) {
    return serverError(e);
  }
}
