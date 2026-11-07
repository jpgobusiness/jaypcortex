import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError } from "@/lib/api";
import { createOvertimeAttachmentFile } from "@/lib/overtime-storage";

// Upload de arquivos/imagens (multipart) para um registro de hora extra.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const entry = await prisma.overtimeEntry.findUnique({ where: { id } });
    if (!entry) return badRequest("Registro não encontrado");

    const form = await req.formData();
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) return badRequest("Nenhum arquivo enviado");

    const created = [];
    for (const f of files) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const att = await createOvertimeAttachmentFile({
        entryId: id,
        name: f.name || "arquivo",
        mimeType: f.type || "application/octet-stream",
        size: f.size,
        bytes,
      });
      created.push(att);
    }
    return ok(created, 201);
  } catch (e) {
    return serverError(e);
  }
}
