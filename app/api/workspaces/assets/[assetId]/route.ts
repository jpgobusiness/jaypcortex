import { requireApiUser } from "@/lib/auth";
import { badRequest, notFound, ok, serverError, str } from "@/lib/api";
import {
  deleteFolderAsset,
  getFolderAssetSigned,
  renameFolderAsset,
} from "@/lib/opportunities/service";

type Ctx = { params: Promise<{ assetId: string }> };

/** URL assinada curta (5 min). */
export async function GET(_req: Request, { params }: Ctx) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const { assetId } = await params;
    return ok(await getFolderAssetSigned(assetId));
  } catch (e) {
    if (e instanceof Error && e.message === "Arquivo não encontrado") return notFound(e.message);
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const { assetId } = await params;
    const body = await req.json();
    const name = str(body.name);
    if (!name) return badRequest("Informe o nome");
    return ok(await renameFolderAsset(assetId, name));
  } catch (e) {
    if (e instanceof Error && e.message === "Arquivo não encontrado") return notFound(e.message);
    if (
      e instanceof Error &&
      (e.message === "Informe o nome" || e.message.startsWith("O nome pode ter até"))
    ) {
      return badRequest(e.message);
    }
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const { assetId } = await params;
    return ok(await deleteFolderAsset(assetId));
  } catch (e) {
    if (e instanceof Error && e.message === "Arquivo não encontrado") return notFound(e.message);
    return serverError(e);
  }
}
