import { readJson, respond } from "@/lib/finance/http";
import { deleteDashboard, updateDashboard } from "@/lib/finance/service";
import { dashboardPatch, parseInput } from "@/lib/finance/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  return respond(async () => {
    const { id } = await params;
    return updateDashboard(id, parseInput(dashboardPatch, await readJson(request)));
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return respond(async () => deleteDashboard((await params).id));
}
