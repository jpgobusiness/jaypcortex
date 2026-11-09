import { badRequest, ok, serverError, str } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createOpportunityFolder } from "@/lib/opportunities/service";

export async function POST(req: Request) {
  const { profile, error } = await requireApiUser();
  if (error) return error;
  try {
    const body = await req.json();
    const name = str(body.name);
    if (!name) return badRequest("Informe o nome");
    const result = await createOpportunityFolder({
      name,
      opportunity_id: str(body.opportunity_id) ?? str(body.opportunityId) ?? undefined,
      createdBy: profile.id,
      source: "ui",
    });
    return ok(result, result.created ? 201 : 200);
  } catch (e) {
    return serverError(e);
  }
}
