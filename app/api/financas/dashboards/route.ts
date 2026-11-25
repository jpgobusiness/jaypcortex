import { readJson, respond } from "@/lib/finance/http";
import { createDashboard, listDashboards } from "@/lib/finance/service";
import { dashboardInput, parseInput } from "@/lib/finance/validation";

export async function GET() {
  return respond(() => listDashboards());
}

export async function POST(request: Request) {
  return respond(async () => createDashboard(parseInput(dashboardInput, await readJson(request))), 201);
}
