import { requireApiUser } from "@/lib/auth";
import { badRequest, notFound, ok, serverError, str } from "@/lib/api";
import {
  listFolderAssets,
  registerDelivery,
  storeFolderAsset,
} from "@/lib/opportunities/service";

type Ctx = { params: Promise<{ id: string }> };

/** Lista assets da pasta (mais recente primeiro). ?kind=entrega */
export async function GET(req: Request, { params }: Ctx) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const kind = str(new URL(req.url).searchParams.get("kind")) ?? undefined;
    return ok(await listFolderAssets(id, kind));
  } catch (e) {
    if (e instanceof Error && e.message === "Pasta não encontrada") return notFound(e.message);
    return serverError(e);
  }
}

/** POST JSON {name, html} = entrega; multipart file + kind = anexo/áudio. */
export async function POST(req: Request, { params }: Ctx) {
  const { profile, error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = await req.json();
      const name = str(body.name);
      if (typeof body.html !== "string") return badRequest("Informe html");
      return ok(await registerDelivery({
        folder_id: id,
        name: name ?? "Proposta",
        html: body.html,
        createdBy: profile.id,
        source: "ui",
      }), 201);
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("Nenhum arquivo enviado");
    const kind = str(form.get("kind")) || "anexo";
    const bytes = new Uint8Array(await file.arrayBuffer());
    return ok(await storeFolderAsset({
      folderId: id,
      kind,
      name: file.name || "arquivo",
      mimeType: file.type || "application/octet-stream",
      bytes,
      createdBy: profile.id,
      source: "ui",
    }), 201);
  } catch (e) {
    if (e instanceof Error && e.message === "Pasta não encontrada") return notFound(e.message);
    if (e instanceof Error && e.message === "O arquivo pode ter no máximo 10 MB") {
      return badRequest(e.message);
    }
    return serverError(e);
  }
}
