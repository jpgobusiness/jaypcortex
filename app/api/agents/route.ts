import { ok, badRequest, serverError } from "@/lib/api";
import { parseAgentInput } from "@/lib/agents";
import {
  createAgentWithRoom,
  ensureOrchestrator,
  isUniqueViolation,
  listAgents,
} from "@/lib/agents-db";

/** Agentes do escritório (o orquestrador vem primeiro e é criado se faltar). */
export async function GET() {
  try {
    await ensureOrchestrator();
    return ok(await listAgents());
  } catch (e) {
    return serverError(e);
  }
}

/** Cria um agente na primeira mesa livre, com a sala dele. */
export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (typeof body !== "object" || body === null) return badRequest("Dados inválidos");

    const parsed = parseAgentInput(body as Record<string, unknown>, { partial: false });
    if ("error" in parsed) return badRequest(parsed.error);
    const { name, ...rest } = parsed.data;
    if (!name) return badRequest("Nome é obrigatório");

    const result = await createAgentWithRoom({ name, ...rest });
    if ("error" in result) return ok({ error: result.error }, 409);
    return ok(result.agent, 201);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return ok({ error: "Essa mesa acabou de ser ocupada. Tente de novo." }, 409);
    }
    return serverError(e);
  }
}
