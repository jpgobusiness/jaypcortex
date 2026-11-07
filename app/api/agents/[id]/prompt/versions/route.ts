import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const versions = await prisma.agentPromptVersion.findMany({
      where: { agentId: id },
      orderBy: { version: "desc" },
    });
    return ok(versions);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await req.json();
    const versionId = String(body.versionId ?? "");
    if (!versionId) return badRequest("versionId");
    const version = await prisma.agentPromptVersion.findFirst({
      where: { id: versionId, agentId: id },
    });
    if (!version) return badRequest("Versão não encontrada");
    await prisma.agent.update({
      where: { id },
      data: { activePromptVersionId: version.id, status: "active" },
    });
    return ok(version);
  } catch (e) {
    return serverError(e);
  }
}
