import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str, dt } from "@/lib/api";
import { createActivity } from "@/lib/activities/service";
import { requestActor } from "@/lib/activities/actor-http";
import { activityGroupInclude, withGroupFields } from "@/lib/activities/groups";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const opportunityId = searchParams.get("opportunityId");
    const status = searchParams.get("status");
    const includeDeleted = searchParams.get("includeDeleted") === "1";
    const groupId = searchParams.get("groupId");
    const activities = await prisma.activity.findMany({
      where: {
        ...(opportunityId ? { opportunityId } : {}),
        ...(status ? { status } : {}),
        ...(groupId ? { groupMemberships: { some: { groupId } } } : {}),
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      include: { type: true, opportunity: { select: { id: true, name: true } }, ...activityGroupInclude },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
    return ok(activities.map((row) => withGroupFields(row)));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = str(body.title);
    if (!title) return badRequest("Título da atividade é obrigatório");
    const actor = await requestActor();
    const created = await createActivity(
      {
        title,
        typeId: str(body.typeId),
        opportunityId: str(body.opportunityId),
        status: str(body.status) ?? "pending",
        priority: str(body.priority) ?? "normal",
        dueDate: dt(body.dueDate) ?? str(body.dueDate),
        notes: str(body.notes),
        description: str(body.description),
        estimatedMinutes: body.estimatedMinutes == null ? null : Number(body.estimatedMinutes) || null,
        importance: body.importance == null ? null : Number(body.importance) || null,
        urgency: body.urgency == null ? null : Number(body.urgency) || null,
        energy: str(body.energy),
        context: str(body.context),
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        area: str(body.area),
        waitingOn: str(body.waitingOn),
        source: "ui",
        groupIds: Array.isArray(body.groupIds) ? body.groupIds.map(String) : undefined,
      },
      actor
    );
    return ok(withGroupFields(created.activity), 201);
  } catch (e) {
    return serverError(e);
  }
}
