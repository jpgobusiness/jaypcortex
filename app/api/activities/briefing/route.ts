import { ok, serverError } from "@/lib/api";
import { getDailyBriefing } from "@/lib/briefing/briefing";
import { parseDatePhrase } from "@/lib/activities/dates";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const parsed = date ? parseDatePhrase(date)?.date : undefined;
    const briefing = await getDailyBriefing(parsed, []);
    return ok(briefing);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = body.date ? parseDatePhrase(String(body.date))?.date : undefined;
    const busy = Array.isArray(body.busy_blocks) ? body.busy_blocks : [];
    const briefing = await getDailyBriefing(parsed, busy);
    return ok(briefing);
  } catch (e) {
    return serverError(e);
  }
}
