import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, num, str, dt } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.date !== undefined) data.date = dt(body.date) ?? new Date();
    if (body.hours !== undefined) {
      const h = num(body.hours);
      if (h === null || h < 0) return badRequest("Horas inválidas");
      data.hours = h;
    }
    if (body.description !== undefined) data.description = str(body.description);
    if (body.clickupRequested !== undefined) {
      data.clickupRequested = Boolean(body.clickupRequested);
    }

    const entry = await prisma.overtimeEntry.update({
      where: { id },
      data,
      include: {
        attachments: {
          select: {
            id: true,
            name: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
      },
    });
    return ok(entry);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await prisma.overtimeEntry.delete({ where: { id } });
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
