import { ok, serverError, notFound } from "@/lib/api";
import {
  deleteOvertimeAttachmentFile,
  readOvertimeAttachmentFile,
} from "@/lib/overtime-storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const att = await readOvertimeAttachmentFile(id);
    if (!att) return notFound("Anexo não encontrado");

    const download = new URL(req.url).searchParams.get("download");
    const disposition = download ? "attachment" : "inline";

    return new Response(att.bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": att.mimeType,
        "Content-Length": String(att.size),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(
          att.name
        )}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const deleted = await deleteOvertimeAttachmentFile(id);
    if (!deleted) return notFound("Anexo não encontrado");
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
