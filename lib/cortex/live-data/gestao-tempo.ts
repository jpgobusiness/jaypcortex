import { listActivities } from "@/lib/activities/service";
import { getDailyBriefing, type BusyBlock } from "@/lib/briefing/briefing";
import { normalize } from "@/lib/cortex/normalize";

function inferListFilters(request: string) {
  const n = normalize(request);
  const filters: Parameters<typeof listActivities>[0] = { status: "open", sort: "score", limit: 15 };
  if (/\batrasad/.test(n)) filters.due = "overdue";
  else if (/\bhoje\b/.test(n)) filters.due = "today";
  else if (/\bsemana\b/.test(n)) filters.due = "this_week";
  if (/\bfila\b/.test(n)) filters.in_queue = true;
  const named = request.match(/["“](.+?)["”]/) || request.match(/\b(?:tarefa|atividade)\s+(?:do|da|de)\s+(.+)$/i);
  if (named?.[1]) filters.q = named[1].trim().slice(0, 80);
  return filters;
}

function summarizeBriefing(briefing: Awaited<ReturnType<typeof getDailyBriefing>>) {
  return {
    date: briefing.date,
    top3: (briefing.top3 ?? []).slice(0, 3).map((a) => ({
      id: a.id, title: a.title, score: a.score, due_text: a.due_text,
    })),
    alerts: briefing.alerts ?? [],
    overdue: briefing.overdue?.length ?? 0,
    dueToday: briefing.due_today?.length ?? 0,
    load: briefing.load ?? null,
  };
}

export async function liveGestaoTempo(request: string, opts: { date?: Date; busyBlocks?: BusyBlock[] }) {
  const briefing = await getDailyBriefing(opts.date, opts.busyBlocks ?? []);
  const activities = await listActivities(inferListFilters(request));
  return {
    briefing: summarizeBriefing(briefing),
    activities: activities.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      priority: a.priority,
      due_text: a.due_text,
      queuePosition: a.queuePosition,
      score: a.score,
    })),
  };
}
