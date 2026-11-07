import { ok, serverError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { composeAgentPrompt, publishPrompt } from "@/lib/agents/prompt-composer";
import { writeAudit } from "@/lib/mcp/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    return ok(await composeAgentPrompt(id));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const { profile, error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const version = await publishPrompt({
      agentId: id,
      note: typeof body.note === "string" ? body.note : undefined,
      createdBy: profile?.id,
      source: "ui",
    });
    await writeAudit({
      actorId: profile?.id,
      actorType: "user",
      action: "publish_prompt",
      entity: "AgentPromptVersion",
      entityId: version.id,
    });
    return ok(version, 201);
  } catch (e) {
    return serverError(e);
  }
}
