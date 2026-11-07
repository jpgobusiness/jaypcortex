import { ok, serverError } from "@/lib/api";
import { getWeeklyReview } from "@/lib/briefing/briefing";
import { parseDatePhrase } from "@/lib/activities/dates";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const weekStart = searchParams.get("weekStart") || searchParams.get("week_start");
    const parsed = weekStart ? parseDatePhrase(weekStart)?.date : undefined;
    return ok(await getWeeklyReview(parsed));
  } catch (e) {
    return serverError(e);
  }
}
