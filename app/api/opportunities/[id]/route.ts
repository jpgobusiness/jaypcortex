import { notFound, ok, serverError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getFunnelOpportunity } from "@/lib/opportunities/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    return ok(await getFunnelOpportunity(id));
  } catch (e) {
    if (e instanceof Error && e.message === "Oportunidade do funil não encontrada") {
      return notFound(e.message);
    }
    return serverError(e);
  }
}
