import { listActivitiesPage } from "@/lib/activities/service";
import { normalize } from "@/lib/cortex/normalize";

function queryFromRequest(request: string) {
  const n = normalize(request);
  const client = request.match(/\b(?:cliente|proposta|conta)\s+([A-Za-z0-9][\w.-]*)/i)?.[1];
  const parts = ["MAP", "assess", "migração"];
  if (client) parts.push(client);
  if (/\bfunding\b/.test(n)) parts.push("funding");
  return parts.join(" ");
}

export async function liveMigracaoAws(request: string) {
  const q = queryFromRequest(request);
  const page = await listActivitiesPage({ q, status: "open", sort: "score", limit: 10 });
  return {
    theme_query: q,
    total: page.total,
    truncated: page.truncated,
    counts: page.counts,
    note: page.note,
    activities: page.activities.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      due_text: a.due_text,
      score: a.score,
    })),
  };
}
