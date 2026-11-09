import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound, serverError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { upsertFileContent } from "@/lib/knowledge/files";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const rows = await prisma.fileRevision.findMany({
      where: { fileId: id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, title: true, hash: true, source: true, note: true, createdAt: true, createdBy: true },
    });
    return ok(rows);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const { profile, error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await req.json();
    const revisionId = String(body.revisionId ?? "");
    if (!revisionId) return badRequest("revisionId");
    const revision = await prisma.fileRevision.findFirst({
      where: { id: revisionId, fileId: id },
    });
    if (!revision) return notFound("Revisão não encontrada");
    const saved = await upsertFileContent({
      fileId: id,
      title: revision.title,
      content: JSON.parse(revision.content),
      createdBy: profile?.id,
      source: "ui",
    });
    return ok(saved.file);
  } catch (e) {
    return serverError(e);
  }
}
