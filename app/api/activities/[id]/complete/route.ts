import { ok, serverError } from "@/lib/api";
import { completeActivity } from "@/lib/activities/service";
import { requestActor } from "@/lib/activities/actor-http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const actor = await requestActor();
    const row = await completeActivity(id, actor);
    return ok(row.activity);
  } catch (e) {
    return serverError(e);
  }
}
