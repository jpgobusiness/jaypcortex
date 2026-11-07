import { ok, serverError } from "@/lib/api";
import { getHistory } from "@/lib/activities/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return ok(await getHistory({ id }));
  } catch (e) {
    return serverError(e);
  }
}
