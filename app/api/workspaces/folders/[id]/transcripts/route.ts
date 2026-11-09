import { requireApiUser } from "@/lib/auth";
import { badRequest, notFound, ok, serverError, str } from "@/lib/api";
import { importTranscript, importTranscriptUpload } from "@/lib/opportunities/service";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED = new Set(["txt", "md", "vtt", "srt", "docx"]);

function extOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Importa transcrição: JSON {title, text} ou multipart file (.txt .md .vtt .srt .docx). */
export async function POST(req: Request, { params }: Ctx) {
  const { profile, error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = await req.json();
      if (typeof body.text !== "string") return badRequest("Informe text");
      return ok(await importTranscript({
        folder_id: id,
        title: str(body.title) ?? undefined,
        text: body.text,
        createdBy: profile.id,
        source: "ui",
      }), 201);
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("Nenhum arquivo enviado");
    const ext = extOf(file.name);
    if (!ALLOWED.has(ext)) return badRequest("Aceito: .txt, .md, .vtt, .srt, .docx");
    const bytes = new Uint8Array(await file.arrayBuffer());
    return ok(await importTranscriptUpload({
      folder_id: id,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes,
      createdBy: profile.id,
      source: "ui",
    }), 201);
  } catch (e) {
    if (e instanceof Error && e.message === "Pasta não encontrada") return notFound(e.message);
    return serverError(e);
  }
}
