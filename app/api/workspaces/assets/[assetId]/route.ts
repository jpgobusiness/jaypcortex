import { requireApiUser } from "@/lib/auth";
import { notFound, ok, serverError } from "@/lib/api";
import { deleteFolderAsset, getFolderAssetSigned } from "@/lib/opportunities/service";

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
