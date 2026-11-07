import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str, dt } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const opportunityId = searchParams.get("opportunityId");
    const status = searchParams.get("status");

    const activities = await prisma.activity.findMany({
      where: {
        ...(opportunityId ? { opportunityId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        type: true,
        opportunity: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
    return ok(activities);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = str(body.title);
    if (!title) return badRequest("Título da atividade é obrigatório");

    const statusKey = str(body.status) ?? "pending";
    const st = await prisma.activityStatus.findUnique({
      where: { key: statusKey },
    });

    const activity = await prisma.activity.create({
      data: {
        title,
        typeId: str(body.typeId),
        opportunityId: str(body.opportunityId),
        status: statusKey,
        completedAt: st?.isDone ? new Date() : null,
        priority: str(body.priority) ?? "normal",
        dueDate: dt(body.dueDate),
        notes: str(body.notes),
      },
      include: {
        type: true,
        opportunity: { select: { id: true, name: true } },
      },
    });
    return ok(activity, 201);
  } catch (e) {
    return serverError(e);
  }
}
