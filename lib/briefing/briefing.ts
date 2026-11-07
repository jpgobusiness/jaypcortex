import { prisma } from "@/lib/prisma";
import { addDaysCivil, civilUtc, daysUntilDue, formatLocalDate, startOfWeekMonday, zonedParts } from "@/lib/activities/dates";
import { scoreActivity } from "@/lib/activities/priority";
import { present } from "@/lib/activities/service";
import { computeFreeSlots, overlapMinutes, placeTasksInSlots, type PlanTask, type TimeSlot } from "./slots";

export type BusyBlock = { start: string; end: string; title?: string };
export { computeFreeSlots, overlapMinutes, placeTasksInSlots };

export async function getDailyBriefing(date?: Date, busyBlocks: BusyBlock[] = []) {
  const now = date ?? new Date();
  const day = zonedParts(now);
  const start = civilUtc(day.y, day.m, day.d);
  const end = civilUtc(addDaysCivil(day, 1).y, addDaysCivil(day, 1).m, addDaysCivil(day, 1).d);
  const weekEnd = civilUtc(addDaysCivil(day, 7).y, addDaysCivil(day, 7).m, addDaysCivil(day, 7).d);
  const statuses = await prisma.activityStatus.findMany();
  const byKey = new Map(statuses.map((s) => [s.key, s]));
  const doneKeys = statuses.filter((s) => s.isDone).map((s) => s.key);
  const inProgressKeys = statuses.filter((s) => s.isInProgress).map((s) => s.key);

  const open = await prisma.activity.findMany({
    where: { deletedAt: null, status: { notIn: doneKeys.length ? doneKeys : ["done"] } },
    include: { type: true },
  });
  const scored = open.map((a) => {
    const st = byKey.get(a.status);
    const s = scoreActivity({
      priority: a.priority,
      importance: a.importance,
      urgency: a.urgency,
      dueDate: a.dueDate,
      queueOrder: a.queueOrder,
      statusIsInProgress: st?.isInProgress,
      waitingOn: a.waitingOn,
      now,
    });
    return { row: a, ...s, presented: present(a, st) };
  });
  scored.sort((a, b) => b.score - a.score);

  const overdue = scored.filter((s) => s.row.dueDate && daysUntilDue(s.row.dueDate, now) < 0);
  const dueToday = scored.filter((s) => s.row.dueDate && daysUntilDue(s.row.dueDate, now) === 0);
  const dueNext7 = scored.filter((s) => {
    if (!s.row.dueDate) return false;
    const d = daysUntilDue(s.row.dueDate, now);
    return d >= 1 && d <= 7;
  });
  const inProgress = scored.filter((s) => inProgressKeys.includes(s.row.status));
  const waiting = scored.filter((s) => Boolean(s.row.waitingOn?.trim()));
  const noDueHigh = scored.filter((s) => !s.row.dueDate && (s.row.priority === "high" || s.row.priority === "urgent"));
  const queueCount = scored.filter((s) => s.row.queueOrder != null).length;

  const reminders = await prisma.activityReminder.findMany({
    where: { remindAt: { lte: now }, dismissedAt: null, activity: { deletedAt: null } },
    include: { activity: { select: { id: true, title: true } } },
    take: 20,
  });

  const weekday = day.weekday;
  const cap = await prisma.timeCapacity.findUnique({ where: { weekday } });
  const work = cap?.workMinutes ?? (weekday === 0 || weekday === 6 ? 0 : 480);
  const focusStart = cap?.focusStart || "09:00";
  const focusEnd = cap?.focusEnd || "18:00";
  const [fsH, fsM] = focusStart.split(":").map(Number);
  const [feH, feM] = focusEnd.split(":").map(Number);
  const windowStart = civilUtc(day.y, day.m, day.d, fsH, fsM);
  const windowEnd = civilUtc(day.y, day.m, day.d, feH, feM);
  let busyMin = 0;
  for (const b of busyBlocks) {
    busyMin += overlapMinutes(windowStart, windowEnd, new Date(b.start), new Date(b.end));
  }
  const free = Math.max(0, work - busyMin);
  const todayLoad = [...dueToday, ...inProgress]
    .reduce((acc, s) => acc + (s.row.estimatedMinutes ?? 30), 0);
  const overbooked = todayLoad > free && free >= 0;

  const alerts: { level: "critico" | "atencao" | "info"; text: string }[] = [];
  if (overdue.length) alerts.push({ level: "critico", text: `${overdue.length} tarefa(s) atrasada(s)` });
  if (overbooked) alerts.push({ level: "critico", text: `Sobrecarga: ${todayLoad} min estimados vs ${free} min livres` });
  if (scored.some((s) => (s.row.priority === "urgent" || (s.row.urgency ?? 0) >= 4) && !s.row.dueDate)) {
    alerts.push({ level: "atencao", text: "Há urgente sem prazo" });
  }
  for (const s of inProgress) {
    if (s.row.startedAt && Date.now() - s.row.startedAt.getTime() > 3 * 86400000) {
      alerts.push({ level: "atencao", text: `'${s.row.title}' em andamento parada há mais de 3 dias` });
    }
  }
  if (queueCount > 7) alerts.push({ level: "atencao", text: `Fila inchada (${queueCount} itens)` });
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
  const completedRecently = await prisma.activity.count({
    where: { completedAt: { gte: threeDaysAgo }, deletedAt: null },
  });
  if (completedRecently === 0) alerts.push({ level: "info", text: "Nenhuma tarefa concluída nos últimos 3 dias" });
  const top3 = scored.slice(0, 3);
  if (top3.some((s) => !s.row.estimatedMinutes)) {
    alerts.push({ level: "info", text: "Top 3 sem estimativa de tempo" });
  }

  const suggestions: string[] = [];
  if (overdue[0]) suggestions.push(`Reagendar '${overdue[0].row.title}' para amanhã ou quebrar em subtarefa`);
  const huge = scored.find((s) => (s.row.estimatedMinutes ?? 0) > 120);
  if (huge) suggestions.push(`Quebrar '${huge.row.title}' em subtarefas`);
  if (top3[0]) suggestions.push(`Começar agora por '${top3[0].row.title}'`);

  void end;
  void weekEnd;

  return {
    date: `${day.y}-${String(day.m).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`,
    top3: top3.map((s) => s.presented),
    in_progress: inProgress.map((s) => s.presented),
    overdue: overdue.map((s) => s.presented),
    due_today: dueToday.map((s) => s.presented),
    due_next_7d: dueNext7.map((s) => s.presented),
    no_due_date_high: noDueHigh.map((s) => s.presented),
    waiting_on: waiting.map((s) => s.presented),
    reminders_due: reminders.map((r) => ({
      id: r.id,
      message: r.message,
      remindAt: r.remindAt,
      activity: r.activity,
    })),
    load: { estimatedMinutes: todayLoad, freeMinutes: free, capacityMinutes: work, busyMinutes: busyMin, overbooked },
    alerts,
    suggestions,
    voice: [
      top3[0] ? `Prioridade do dia: ${top3[0].presented.title}.` : "Nada urgente na lista.",
      top3.slice(0, 3).map((s, i) => `${i + 1}. ${s.presented.title}`).join(" "),
      alerts.filter((a) => a.level === "critico").map((a) => a.text).join(". "),
      suggestions[0] || "",
    ].filter(Boolean).join(" ").slice(0, 700),
  };
}

export async function getWeeklyReview(weekStart?: Date) {
  const start = weekStart ?? startOfWeekMonday();
  const end = new Date(start.getTime() + 7 * 86400000);
  const statuses = await prisma.activityStatus.findMany();
  const doneKeys = statuses.filter((s) => s.isDone).map((s) => s.key);
  const created = await prisma.activity.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: { id: true, title: true, area: true, typeId: true, spentMinutes: true, status: true, completedAt: true, deletedAt: true },
  });
  const completed = await prisma.activity.findMany({
    where: { completedAt: { gte: start, lt: end }, deletedAt: null },
  });
  const overdue = await prisma.activity.findMany({
    where: { deletedAt: null, dueDate: { lt: new Date() }, status: { notIn: doneKeys.length ? doneKeys : ["done"] } },
  });
  const byArea: Record<string, { spent: number; count: number }> = {};
  for (const c of completed) {
    const area = c.area || "sem área";
    byArea[area] = byArea[area] || { spent: 0, count: 0 };
    byArea[area].spent += c.spentMinutes;
    byArea[area].count += 1;
  }
  const stuck = await prisma.activity.findMany({
    where: {
      deletedAt: null,
      status: { notIn: doneKeys.length ? doneKeys : ["done"] },
      updatedAt: { lt: new Date(Date.now() - 7 * 86400000) },
    },
    take: 20,
    select: { id: true, title: true, updatedAt: true },
  });
  return {
    week_start: start.toISOString(),
    created: created.length,
    completed: completed.length,
    completion_rate: created.length ? Math.round((completed.length / created.length) * 100) : null,
    overdue: overdue.map((o) => ({ id: o.id, title: o.title, due_text: formatLocalDate(o.dueDate) })),
    spent_by_area: byArea,
    stuck,
    voice: `Semana: ${completed.length} concluídas, ${created.length} criadas, ${overdue.length} atrasadas.`,
  };
}

export async function planDay(opts: {
  date?: Date;
  busyBlocks?: BusyBlock[];
  strategy?: string;
  apply?: boolean;
  actor?: { actorId?: string | null; source?: string };
}) {
  const briefing = await getDailyBriefing(opts.date, opts.busyBlocks || []);
  const now = opts.date ?? new Date();
  const day = zonedParts(now);
  const cap = await prisma.timeCapacity.findUnique({ where: { weekday: day.weekday } });
  const [fsH, fsM] = (cap?.focusStart || "09:00").split(":").map(Number);
  const [feH, feM] = (cap?.focusEnd || "18:00").split(":").map(Number);
  const busy: TimeSlot[] = (opts.busyBlocks || []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  const windowStart = civilUtc(day.y, day.m, day.d, fsH, fsM);
  const dayEnd = civilUtc(day.y, day.m, day.d, feH, feM);
  const free = computeFreeSlots(windowStart, dayEnd, busy);

  const pool = [...briefing.top3, ...briefing.due_today, ...briefing.overdue, ...briefing.in_progress];
  const seen = new Set<string>();
  const tasks: PlanTask[] = [];
  for (const p of pool) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const full = await prisma.activity.findUnique({ where: { id: p.id } });
    if (!full) continue;
    tasks.push({ id: p.id, title: p.title, minutes: full.estimatedMinutes ?? 30, energy: full.energy });
  }
  const plan = placeTasksInSlots(free, tasks, dayEnd);

  if (opts.apply && opts.actor) {
    for (const p of plan) {
      await prisma.activity.update({
        where: { id: p.activityId },
        data: { scheduledStart: new Date(p.start), scheduledEnd: new Date(p.end) },
      });
      await prisma.activityEvent.create({
        data: {
          activityId: p.activityId,
          type: "rescheduled",
          after: p as never,
          actorId: opts.actor.actorId ?? null,
          source: opts.actor.source || "mcp",
        },
      });
    }
  }

  return { plan, applied: Boolean(opts.apply), voice: plan[0] ? `Primeiro bloco: ${plan[0].title}.` : "Sem janela livre hoje." };
}
