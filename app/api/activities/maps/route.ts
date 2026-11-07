import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str } from "@/lib/api";

async function ensureLibrary() {
  const count = await prisma.mindMap.count();
  if (count === 0) {
    await prisma.mindMap.create({
      data: { name: "Mapa 1", order: 0 },
    });
  }
}

export async function GET() {
  try {
    await ensureLibrary();
    const [groups, maps] = await Promise.all([
      prisma.mindMapGroup.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] }),
      prisma.mindMap.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] }),
    ]);
    return ok({ groups, maps });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = str(body.name);
    if (!name) return badRequest("Nome do mapa é obrigatório");

    const groupId = str(body.groupId);
    if (groupId) {
      const group = await prisma.mindMapGroup.findUnique({ where: { id: groupId } });
      if (!group) return badRequest("Grupo não encontrado");
    }

    const last = await prisma.mindMap.findFirst({
      where: { groupId: groupId ?? null },
      orderBy: { order: "desc" },
    });

    const map = await prisma.mindMap.create({
      data: {
        name,
        groupId: groupId ?? null,
        order: (last?.order ?? -1) + 1,
      },
    });
    return ok(map, 201);
  } catch (e) {
    return serverError(e);
  }
}
