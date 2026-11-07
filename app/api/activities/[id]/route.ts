import { ok, serverError, str, dt, num, badRequest } from "@/lib/api";
import { restoreActivity, softDelete, updateActivity } from "@/lib/activities/service";
import { requestActor } from "@/lib/activities/actor-http";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    const actor = await requestActor();
    const updated = await updateActivity(
      id,
      {
        title: body.title !== undefined ? str(body.title) ?? undefined : undefined,
        typeId: body.typeId !== undefined ? str(body.typeId) : undefined,
        opportunityId: body.opportunityId !== undefined ? str(body.opportunityId) : undefined,
        priority: body.priority !== undefined ? str(body.priority) ?? undefined : undefined,
        dueDate: body.dueDate !== undefined ? dt(body.dueDate) ?? str(body.dueDate) : undefined,
        notes: body.notes !== undefined ? str(body.notes) : undefined,
        description: body.description !== undefined ? str(body.description) : undefined,
        estimatedMinutes: body.estimatedMinutes !== undefined ? num(body.estimatedMinutes) : undefined,
        importance: body.importance !== undefined ? num(body.importance) : undefined,
        urgency: body.urgency !== undefined ? num(body.urgency) : undefined,
        energy: body.energy !== undefined ? str(body.energy) : undefined,
        context: body.context !== undefined ? str(body.context) : undefined,
        tags: body.tags !== undefined ? (Array.isArray(body.tags) ? body.tags.map(String) : []) : undefined,
        area: body.area !== undefined ? str(body.area) : undefined,
        waitingOn: body.waitingOn !== undefined ? str(body.waitingOn) : undefined,
        status: body.status !== undefined ? str(body.status) ?? undefined : undefined,
        scheduledStart: body.scheduledStart !== undefined ? body.scheduledStart : undefined,
        scheduledEnd: body.scheduledEnd !== undefined ? body.scheduledEnd : undefined,
      },
      actor
    );
    return ok(updated.activity);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const restore = searchParams.get("restore") === "1";
    const actor = await requestActor();
    if (restore) {
      const row = await restoreActivity(id, actor);
      return ok(row.activity);
    }
    const confirm = searchParams.get("confirm") !== "0";
    const row = await softDelete(id, actor, confirm);
    return ok(row.activity);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message.includes("confirm")) return badRequest(message);
    return serverError(e);
  }
}
