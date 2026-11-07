import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str } from "@/lib/api";

export async function GET() {
  try {
    const types = await prisma.activityType.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { activities: true } } },
    });
    return ok(types);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = str(body.name);
    if (!name) return badRequest("Nome do tipo é obrigatório");
    const type = await prisma.activityType.create({
      data: { name, color: str(body.color) ?? "#6366f1" },
    });
    return ok(type, 201);
  } catch (e) {
    return serverError(e);
  }
}
