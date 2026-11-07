import { ok, serverError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { rejectProposal } from "@/lib/proposals/service";
import { writeAudit } from "@/lib/mcp/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { profile, error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const row = await rejectProposal(id);
    await writeAudit({
      actorId: profile?.id,
      actorType: "user",
      action: "reject_proposal",
      entity: "ChangeProposal",
      entityId: row.id,
    });
    return ok(row);
  } catch (e) {
    return serverError(e);
  }
}
