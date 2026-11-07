import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = str(body.name);
    if (!name) return badRequest("Nome do grupo é obrigatório");

    const last = await prisma.mindMapGroup.findFirst({ orderBy: { order: "desc" } });
    const group = await prisma.mindMapGroup.create({
      data: { name, order: (last?.order ?? -1) + 1 },
    });
    return ok(group, 201);
  } catch (e) {
    return serverError(e);
  }
}
