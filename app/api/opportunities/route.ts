import { ok, serverError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { listFunnelOpportunities } from "@/lib/opportunities/service";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    return ok(await listFunnelOpportunities());
  } catch (e) {
    return serverError(e);
  }
}
