import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str, num } from "@/lib/api";

/** Lista todos os itens do desafio (ativos e inativos). */
export async function GET() {
  try {
    const items = await prisma.challengeItem.findMany({
      orderBy: { order: "asc" },
    });
    return ok(items);
  } catch (e) {
    return serverError(e);
  }
}

/** Cria um novo item do desafio. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = str(body.name);
    if (!name) return badRequest("Nome do item é obrigatório");

    // Próximo order disponível
    const last = await prisma.challengeItem.findFirst({
      orderBy: { order: "desc" },
    });
    const nextOrder = (last?.order ?? 0) + 1;

    const item = await prisma.challengeItem.create({
      data: {
        name,
        icon: str(body.icon) ?? "circle",
        order: num(body.order) ?? nextOrder,
        active: body.active !== false,
      },
    });
    return ok(item, 201);
  } catch (e) {
    return serverError(e);
  }
}
