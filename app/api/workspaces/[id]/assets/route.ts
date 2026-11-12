import { requireApiUser } from "@/lib/auth";
import { badRequest, notFound, ok, serverError, str } from "@/lib/api";
import { listWorkspaceRootAssets, storeFolderAsset } from "@/lib/opportunities/service";

type Ctx = { params: Promise<{ id: string }> };

function assetError(e: unknown) {
  if (!(e instanceof Error)) return serverError(e);
  if (e.message === "Espaço não encontrado" || e.message === "Pasta não encontrada") {
    return notFound(e.message);
  }
  if (
    e.message === "O arquivo pode ter no máximo 10 MB" ||
    e.message === "Informe o espaço ou a pasta"
  ) {
    return badRequest(e.message);
  }
  return serverError(e);
}

/** Anexos soltos no espaço (folderId nulo). */
export async function GET(_req: Request, { params }: Ctx) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    return ok(await listWorkspaceRootAssets(id));
  } catch (e) {
    return assetError(e);
  }
}

/** Multipart: campo `file` (+ `kind` opcional, padrão anexo). */
export async function POST(req: Request, { params }: Ctx) {
  const { profile, error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("Nenhum arquivo enviado");
    const kind = str(form.get("kind")) || "anexo";
    const bytes = new Uint8Array(await file.arrayBuffer());
    return ok(
      await storeFolderAsset({
        workspaceId: id,
        kind,
        name: file.name || "arquivo",
        mimeType: file.type || "application/octet-stream",
        bytes,
        createdBy: profile.id,
        source: "ui",
      }),
      201
    );
  } catch (e) {
    return assetError(e);
  }
}
