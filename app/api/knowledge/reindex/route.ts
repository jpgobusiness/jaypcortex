import { ok, serverError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { indexFile, reindexPending } from "@/lib/knowledge/indexer";

export async function POST(req: Request) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.fileId === "string") {
      return ok(await indexFile(body.fileId, { force: true }));
    }
    return ok(await reindexPending(40));
  } catch (e) {
    return serverError(e);
  }
}
