export type ActivityCounts = { open: number; done: number; in_queue: number };

export function activityPageEnvelope<T>(opts: {
  activities: T[];
  total: number;
  limit: number;
  status?: string;
  counts: ActivityCounts;
}) {
  const returned = opts.activities.length;
  const truncated = opts.total > returned;
  const status = opts.status || "all";
  const note = truncated
    ? `Há ${opts.total} neste filtro; esta página tem ${returned} (limit ${opts.limit}). NÃO diga que estas são todas. Use total e counts.`
    : `Total neste filtro: ${opts.total}. Panorama: ${opts.counts.open} pendentes, ${opts.counts.done} concluídas, ${opts.counts.in_queue} na fila.`;
  return {
    activities: opts.activities,
    total: opts.total,
    returned,
    truncated,
    limit: opts.limit,
    status,
    counts: opts.counts,
    note,
  };
}
