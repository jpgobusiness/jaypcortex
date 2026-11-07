import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str, num } from "@/lib/api";

// Lista os status com a contagem de atividades em cada um.
export async function GET() {
  try {
    const statuses = await prisma.activityStatus.findMany({
      orderBy: { order: "asc" },
    });
    const grouped = await prisma.activity.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const countByKey = new Map(
      grouped.map((g) => [g.status, g._count._all])
    );
    return ok(
      statuses.map((s) => ({
        ...s,
        _count: { activities: countByKey.get(s.key) ?? 0 },
      }))
    );
  } catch (e) {
    return serverError(e);
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = str(body.name);
    if (!name) return badRequest("Nome do status é obrigatório");

    const key =
      (slugify(name) || "status") + "_" + Math.random().toString(36).slice(2, 7);
    const last = await prisma.activityStatus.findFirst({
      orderBy: { order: "desc" },
    });

    const status = await prisma.activityStatus.create({
      data: {
        key,
        name,
        color: str(body.color) ?? "#6366f1",
        order: num(body.order) ?? (last?.order ?? 0) + 1,
        isDone: Boolean(body.isDone),
      },
    });
    return ok(status, 201);
  } catch (e) {
    return serverError(e);
  }
}
