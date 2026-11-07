import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound, serverError } from "@/lib/api";
import { parseAgentRouting } from "@/lib/cortex/routing-schema";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const row = await prisma.agent.findUnique({
      where: { id },
      select: { id: true, slug: true, name: true, routing: true },
    });
    if (!row) return notFound("Agente não encontrado");
    return ok(row);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body: unknown = await req.json();
    const routingValue = body && typeof body === "object" && "routing" in body
      ? (body as { routing: unknown }).routing
      : body;
    const parsed = parseAgentRouting(routingValue);
    if (!parsed.ok) return badRequest(parsed.error);
    const exists = await prisma.agent.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return notFound("Agente não encontrado");
    const row = await prisma.agent.update({
      where: { id },
      data: { routing: parsed.data as object },
      select: { id: true, slug: true, name: true, routing: true },
    });
    return ok(row);
  } catch (e) {
    return serverError(e);
  }
}
