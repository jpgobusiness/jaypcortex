import { ok, serverError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { applyProposal } from "@/lib/proposals/service";
import { writeAudit } from "@/lib/mcp/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { profile, error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const row = await applyProposal({
      id,
      appliedBy: profile?.id,
      publish: Boolean(body.publish),
    });
    await writeAudit({
      actorId: profile?.id,
      actorType: "user",
      action: "apply_proposal",
      entity: "ChangeProposal",
      entityId: row.id,
    });
    return ok(row);
  } catch (e) {
    return serverError(e);
  }
}
