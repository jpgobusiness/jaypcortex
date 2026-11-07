import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/mcp/audit";
import { MCP_ISSUER } from "@/lib/mcp/http";
import { addDaysCivil, civilUtc, daysUntilDue, formatLocalDate, nextDueFromRrule, parseDatePhrase, zonedParts } from "./dates";
import { scoreActivity } from "./priority";

export type Actor = { actorId?: string | null; source?: string };

const INCLUDE = {
  type: true,
  opportunity: { select: { id: true, name: true } },
} as const;

export class ActivityAmbiguousError extends Error {
  candidates: { id: string; title: string }[];
  constructor(candidates: { id: string; title: string }[]) {
    super("Mais de uma tarefa parecida. Escolha pelo id.");
    this.candidates = candidates;
  }
}

export class ActivityNotFoundError extends Error {
  constructor(message: string) {
    super(message);
  }
}

async function statuses() {
  const all = await prisma.activityStatus.findMany({ orderBy: { order: "asc" } });
  return {
    all,
    inProgress: all.find((s) => s.isInProgress) ?? all.find((s) => s.key === "in_progress") ?? null,
    done: all.find((s) => s.isDone) ?? null,
    pending: all.find((s) => !s.isDone && !s.isInProgress) ?? all.find((s) => s.key === "pending") ?? all[0] ?? null,
    byKey: new Map(all.map((s) => [s.key, s])),
  };
}

function snap(row: Record<string, unknown> | null | undefined) {
  if (!row) return null;
  const { type, opportunity, events, sessions, reminders, children, parent, mapNodes, ...rest } = row as Record<string, unknown>;
  void type;
  void opportunity;
  void events;
  void sessions;
  void reminders;
  void children;
  void parent;
  void mapNodes;
  return rest;
}

async function emit(opts: {
  activityId: string;
  type: string;
  before?: unknown;
  after?: unknown;
  actor: Actor;
}) {
  await prisma.activityEvent.create({
    data: {
      activityId: opts.activityId,
      type: opts.type,
      before: opts.before as never,
      after: opts.after as never,
      actorId: opts.actor.actorId ?? null,
      source: opts.actor.source || "ui",
    },
  });
  await writeAudit({
    actorId: opts.actor.actorId ?? null,
    actorType: opts.actor.source === "ui" ? "user" : "mcp",
    action: `activity_${opts.type}`,
    entity: "Activity",
    entityId: opts.activityId,
    meta: { source: opts.actor.source || "ui" },
  });
}

export function present(row: {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  queueOrder: number | null;
  importance?: number | null;
  urgency?: number | null;
  waitingOn?: string | null;
  estimatedMinutes?: number | null;
  spentMinutes?: number | null;
  deletedAt?: Date | null;
  type?: { name: string } | null;
}, st?: { isInProgress?: boolean; name?: string; isDone?: boolean } | null) {
  const scored = scoreActivity({
    priority: row.priority,
    importance: row.importance,
    urgency: row.urgency,
    dueDate: row.dueDate,
    queueOrder: row.queueOrder,
    statusIsInProgress: st?.isInProgress,
    waitingOn: row.waitingOn,
  });
  const dueText = formatLocalDate(row.dueDate);
  const voice = `${row.title}${dueText ? `, prazo ${dueText}` : ""}${row.queueOrder ? `, #${row.queueOrder} na fila` : ""}`;
  return {
    id: row.id,
    title: row.title,
    status: { key: row.status, name: st?.name || row.status },
    priority: row.priority,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    due_text: dueText,
    queuePosition: row.queueOrder,
    estimatedMinutes: row.estimatedMinutes ?? null,
    spentMinutes: row.spentMinutes ?? 0,
    type: row.type?.name ?? null,
    score: scored.score,
    reasons: scored.reasons,
    url: `${MCP_ISSUER}/atividades`,
    voice,
    deleted: Boolean(row.deletedAt),
  };
}

export async function resolveActivity(opts: { id?: string | null; query?: string | null; includeDeleted?: boolean }) {
  if (opts.id) {
    const row = await prisma.activity.findUnique({
      where: { id: opts.id },
      include: { ...INCLUDE, children: true, reminders: true, sessions: { orderBy: { startedAt: "desc" }, take: 10 } },
    });
    if (!row || (row.deletedAt && !opts.includeDeleted)) {
      throw new ActivityNotFoundError(`Não achei a tarefa ${opts.id}.`);
    }
    return row;
  }
  const q = opts.query?.trim();
  if (!q) throw new ActivityNotFoundError("Informe id ou query da tarefa.");
  const ids = await searchIds(q, 8, opts.includeDeleted);
  if (ids.length === 0) throw new ActivityNotFoundError(`Não achei tarefa com '${q}'.`);
  const rows = await prisma.activity.findMany({
    where: { id: { in: ids } },
    include: { ...INCLUDE, children: true, reminders: true, sessions: { orderBy: { startedAt: "desc" }, take: 10 } },
  });
  const ordered = ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as typeof rows;
  if (ordered.length === 1) return ordered[0];
  throw new ActivityAmbiguousError(ordered.map((r) => ({ id: r.id, title: r.title })));
}

async function searchIds(q: string, limit: number, includeDeleted?: boolean): Promise<string[]> {
  try {
    const fts = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Activity"
      WHERE (${includeDeleted ?? false} OR "deletedAt" IS NULL)
        AND "searchTsv" @@ websearch_to_tsquery('portuguese', public.immutable_unaccent(${q}))
      ORDER BY ts_rank("searchTsv", websearch_to_tsquery('portuguese', public.immutable_unaccent(${q}))) DESC
      LIMIT ${limit}
    `;
    if (fts.length) return fts.map((r) => r.id);
  } catch {
    /* fallback ILIKE */
  }
  const rows = await prisma.activity.findMany({
    where: {
      ...(includeDeleted ? {} : { deletedAt: null }),
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => r.id);
}

export async function listActivities(opts: {
  status?: string;
  priority?: string;
  due?: string;
  type?: string;
  tags?: string[];
  area?: string;
  q?: string;
  in_queue?: boolean;
  include_deleted?: boolean;
  sort?: string;
  limit?: number;
  parentId?: string | null;
}) {
  const st = await statuses();
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const now = new Date();
  const today = now;
  const where: Record<string, unknown> = {};
  if (!opts.include_deleted) where.deletedAt = null;
  if (opts.parentId !== undefined) where.parentId = opts.parentId;
  if (opts.priority) where.priority = opts.priority;
  if (opts.area) where.area = opts.area;
  if (opts.tags?.length) where.tags = { hasSome: opts.tags };
  if (opts.in_queue) where.queueOrder = { not: null };
  if (opts.type) {
    const t = await prisma.activityType.findFirst({
      where: { OR: [{ id: opts.type }, { name: { equals: opts.type, mode: "insensitive" } }] },
    });
    if (t) where.typeId = t.id;
  }
  if (opts.status === "open") {
    const doneKeys = st.all.filter((s) => s.isDone).map((s) => s.key);
    where.status = { notIn: doneKeys };
  } else if (opts.status === "done") {
    const doneKeys = st.all.filter((s) => s.isDone).map((s) => s.key);
    where.status = { in: doneKeys };
  } else if (opts.status && opts.status !== "all") {
    where.status = opts.status;
  }
  if (opts.due === "overdue") {
    where.dueDate = { lt: civilStart(today) };
    const doneKeys = st.all.filter((s) => s.isDone).map((s) => s.key);
    where.status = { notIn: doneKeys };
  } else if (opts.due === "today") {
    where.dueDate = { gte: civilStart(today), lt: civilStart(today, 1) };
  } else if (opts.due === "tomorrow") {
    where.dueDate = { gte: civilStart(today, 1), lt: civilStart(today, 2) };
  } else if (opts.due === "this_week" || opts.due === "next_7d") {
    where.dueDate = { gte: civilStart(today), lt: civilStart(today, 7) };
  } else if (opts.due === "no_date") {
    where.dueDate = null;
  }
  if (opts.q) {
    const ids = await searchIds(opts.q, limit, opts.include_deleted);
    where.id = { in: ids.length ? ids : ["__none__"] };
  }
  const order =
    opts.sort === "due"
      ? [{ dueDate: "asc" as const }, { createdAt: "desc" as const }]
      : opts.sort === "queue"
        ? [{ queueOrder: "asc" as const }]
        : opts.sort === "created"
          ? [{ createdAt: "desc" as const }]
          : [{ queueOrder: "asc" as const }, { dueDate: "asc" as const }, { createdAt: "desc" as const }];
  const rows = await prisma.activity.findMany({
    where,
    include: INCLUDE,
    orderBy: order,
    take: opts.sort === "score" ? Math.min(limit * 3, 200) : limit,
  });
  const presented = rows.map((r) => present(r, st.byKey.get(r.status)));
  if (opts.sort === "score") presented.sort((a, b) => b.score - a.score);
  return presented.slice(0, limit);
}

function civilStart(now: Date, plusDays = 0) {
  const p = addDaysCivil(zonedParts(now), plusDays);
  return civilUtc(p.y, p.m, p.d);
}

export async function getActivity(opts: { id?: string; query?: string; includeDeleted?: boolean }) {
  const st = await statuses();
  const row = await resolveActivity(opts);
  const events = await prisma.activityEvent.findMany({
    where: { activityId: row.id },
    orderBy: { at: "desc" },
    take: 20,
  });
  const scored = present(row, st.byKey.get(row.status));
  return {
    ...scored,
    description: row.description,
    notes: row.notes,
    energy: row.energy,
    context: row.context,
    tags: row.tags,
    area: row.area,
    waitingOn: row.waitingOn,
    importance: row.importance,
    urgency: row.urgency,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    recurrenceRule: row.recurrenceRule,
    source: row.source,
    subtasks: row.children?.map((c) => ({ id: c.id, title: c.title, status: c.status })) ?? [],
    reminders: row.reminders,
    sessions: row.sessions,
    history: events,
  };
}

type CreateInput = {
  title?: string;
  typeId?: string | null;
  type?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDate?: string | Date | null;
  notes?: string | null;
  description?: string | null;
  estimatedMinutes?: number | null;
  scheduledStart?: string | Date | null;
  scheduledEnd?: string | Date | null;
  importance?: number | null;
  urgency?: number | null;
  energy?: string | null;
  context?: string | null;
  tags?: string[] | null;
  area?: string | null;
  waitingOn?: string | null;
  parentId?: string | null;
  recurrenceRule?: string | null;
  clientKey?: string | null;
  addToQueue?: boolean | number | null;
  source?: string | null;
  opportunityId?: string | null;
};

function asDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const parsed = parseDatePhrase(typeof v === "string" ? v : v);
  return parsed?.date ?? null;
}

async function resolveTypeId(typeId?: string | null, typeName?: string | null) {
  if (typeId) return typeId;
  if (!typeName) return null;
  const t = await prisma.activityType.findFirst({
    where: { name: { equals: typeName, mode: "insensitive" } },
  });
  return t?.id ?? null;
}

export async function createActivity(input: CreateInput, actor: Actor) {
  if (input.clientKey) {
    const existing = await prisma.activity.findUnique({ where: { clientKey: input.clientKey }, include: INCLUDE });
    if (existing) {
      const st = await statuses();
      return { activity: existing, presented: present(existing, st.byKey.get(existing.status)), idempotent: true };
    }
  }
  const st = await statuses();
  const statusKey = input.status || st.pending?.key || "pending";
  const due = asDate(input.dueDate ?? undefined);
  if (!input.title?.trim()) throw new Error("Título da atividade é obrigatório");
  const row = await prisma.activity.create({
    data: {
      title: input.title.trim(),
      typeId: await resolveTypeId(input.typeId, input.type),
      opportunityId: input.opportunityId ?? null,
      status: statusKey,
      priority: input.priority || "normal",
      dueDate: due,
      notes: input.notes ?? null,
      description: input.description ?? null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      scheduledStart: asDate(input.scheduledStart ?? undefined),
      scheduledEnd: asDate(input.scheduledEnd ?? undefined),
      importance: input.importance ?? null,
      urgency: input.urgency ?? null,
      energy: input.energy ?? null,
      context: input.context ?? null,
      tags: input.tags ?? [],
      area: input.area ?? null,
      waitingOn: input.waitingOn ?? null,
      parentId: input.parentId ?? null,
      recurrenceRule: input.recurrenceRule ?? null,
      clientKey: input.clientKey?.trim() || null,
      source: input.source || actor.source || "ui",
      createdBy: actor.actorId ?? null,
      updatedBy: actor.actorId ?? null,
      completedAt: st.byKey.get(statusKey)?.isDone ? new Date() : null,
    },
    include: INCLUDE,
  });
  if (input.addToQueue) {
    await queueAdd([row.id], typeof input.addToQueue === "number" ? input.addToQueue : undefined, actor, true);
  }
  const fresh = await prisma.activity.findUnique({ where: { id: row.id }, include: INCLUDE });
  await emit({ activityId: row.id, type: "created", after: snap(fresh as never), actor });
  return { activity: fresh!, presented: present(fresh!, st.byKey.get(fresh!.status)), idempotent: false, interpreted_as: due ? parseDatePhrase(input.dueDate as string)?.interpreted_as : undefined };
}

export async function createActivitiesBulk(items: CreateInput[], actor: Actor) {
  const out = [];
  for (const item of items.slice(0, 30)) {
    if (!item.title?.trim()) continue;
    out.push(await createActivity(item, actor));
  }
  return out;
}

export async function updateActivity(id: string, patch: CreateInput & Record<string, unknown>, actor: Actor) {
  const before = await prisma.activity.findUnique({ where: { id } });
  if (!before || before.deletedAt) throw new ActivityNotFoundError("Tarefa não encontrada.");
  const st = await statuses();
  const data: Record<string, unknown> = { updatedBy: actor.actorId ?? null };
  if (patch.title !== undefined) data.title = String(patch.title);
  if (patch.priority !== undefined) data.priority = patch.priority;
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.estimatedMinutes !== undefined) data.estimatedMinutes = patch.estimatedMinutes;
  if (patch.importance !== undefined) data.importance = patch.importance;
  if (patch.urgency !== undefined) data.urgency = patch.urgency;
  if (patch.energy !== undefined) data.energy = patch.energy;
  if (patch.context !== undefined) data.context = patch.context;
  if (patch.tags !== undefined) data.tags = patch.tags;
  if (patch.area !== undefined) data.area = patch.area;
  if (patch.waitingOn !== undefined) data.waitingOn = patch.waitingOn;
  if (patch.parentId !== undefined) data.parentId = patch.parentId;
  if (patch.recurrenceRule !== undefined) data.recurrenceRule = patch.recurrenceRule;
  if (patch.opportunityId !== undefined) data.opportunityId = patch.opportunityId;
  if (patch.dueDate !== undefined) data.dueDate = asDate(patch.dueDate as string);
  if (patch.scheduledStart !== undefined) data.scheduledStart = asDate(patch.scheduledStart as string);
  if (patch.scheduledEnd !== undefined) data.scheduledEnd = asDate(patch.scheduledEnd as string);
  if (patch.typeId !== undefined || patch.type !== undefined) data.typeId = await resolveTypeId(patch.typeId as string, patch.type as string);
  if (patch.status !== undefined) {
    const key = String(patch.status);
    const def = st.byKey.get(key);
    data.status = key;
    data.completedAt = def?.isDone ? new Date() : null;
    if (def?.isDone) data.queueOrder = null;
  }
  const row = await prisma.activity.update({ where: { id }, data, include: INCLUDE });
  await emit({ activityId: id, type: patch.status !== undefined ? "status_changed" : "updated", before: snap(before as never), after: snap(row as never), actor });
  return { activity: row, presented: present(row, st.byKey.get(row.status)) };
}

async function closeOpenSession(activityId: string) {
  const open = await prisma.activitySession.findFirst({
    where: { activityId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!open) return 0;
  const minutes = Math.max(1, Math.round((Date.now() - open.startedAt.getTime()) / 60000));
  await prisma.activitySession.update({
    where: { id: open.id },
    data: { endedAt: new Date(), minutes },
  });
  await prisma.activity.update({
    where: { id: activityId },
    data: { spentMinutes: { increment: minutes } },
  });
  return minutes;
}

export async function startActivity(id: string, actor: Actor) {
  const st = await statuses();
  const key = st.inProgress?.key;
  if (!key) throw new Error("Não há status 'em andamento' configurado.");
  const open = await prisma.activitySession.findFirst({ where: { endedAt: null }, orderBy: { startedAt: "desc" } });
  if (open && open.activityId !== id) await pauseActivity(open.activityId, actor);
  const before = await prisma.activity.findUnique({ where: { id } });
  if (!before || before.deletedAt) throw new ActivityNotFoundError("Tarefa não encontrada.");
  const row = await prisma.activity.update({
    where: { id },
    data: { status: key, startedAt: before.startedAt ?? new Date(), updatedBy: actor.actorId ?? null },
    include: INCLUDE,
  });
  await prisma.activitySession.create({ data: { activityId: id, startedAt: new Date() } });
  await emit({ activityId: id, type: "started", before: snap(before as never), after: snap(row as never), actor });
  return { activity: row, presented: present(row, st.byKey.get(row.status)), voice: `Comecei '${row.title}'.` };
}

export async function pauseActivity(id: string, actor: Actor) {
  const before = await prisma.activity.findUnique({ where: { id } });
  if (!before || before.deletedAt) throw new ActivityNotFoundError("Tarefa não encontrada.");
  const minutes = await closeOpenSession(id);
  const row = await prisma.activity.findUnique({ where: { id }, include: INCLUDE });
  await emit({ activityId: id, type: "paused", before: snap(before as never), after: snap(row as never), actor });
  const st = await statuses();
  return { activity: row!, presented: present(row!, st.byKey.get(row!.status)), voice: `Pausei '${row!.title}' (${minutes} min).` };
}

export async function completeActivity(id: string, actor: Actor) {
  const st = await statuses();
  const done = st.done?.key;
  if (!done) throw new Error("Não há status de concluída configurado.");
  await closeOpenSession(id);
  const before = await prisma.activity.findUnique({ where: { id } });
  if (!before || before.deletedAt) throw new ActivityNotFoundError("Tarefa não encontrada.");
  const row = await prisma.activity.update({
    where: { id },
    data: { status: done, completedAt: new Date(), queueOrder: null, updatedBy: actor.actorId ?? null },
    include: INCLUDE,
  });
  await emit({ activityId: id, type: "completed", before: snap(before as never), after: snap(row as never), actor });
  if (before.recurrenceRule && before.dueDate) {
    const nextDue = nextDueFromRrule(before.recurrenceRule, before.dueDate);
    if (nextDue) {
      await createActivity({
        title: before.title,
        typeId: before.typeId,
        priority: before.priority,
        dueDate: nextDue,
        notes: before.notes,
        description: before.description,
        estimatedMinutes: before.estimatedMinutes,
        importance: before.importance,
        urgency: before.urgency,
        energy: before.energy,
        context: before.context,
        tags: before.tags,
        area: before.area,
        recurrenceRule: before.recurrenceRule,
        source: before.source,
      }, actor);
    }
  }
  return { activity: row, presented: present(row, st.byKey.get(row.status)), voice: `Concluí '${row.title}'.` };
}

export async function reopenActivity(id: string, actor: Actor) {
  const st = await statuses();
  const pending = st.pending?.key || "pending";
  const before = await prisma.activity.findUnique({ where: { id } });
  if (!before || before.deletedAt) throw new ActivityNotFoundError("Tarefa não encontrada.");
  const row = await prisma.activity.update({
    where: { id },
    data: { status: pending, completedAt: null, updatedBy: actor.actorId ?? null },
    include: INCLUDE,
  });
  await emit({ activityId: id, type: "reopened", before: snap(before as never), after: snap(row as never), actor });
  return { activity: row, presented: present(row, st.byKey.get(row.status)) };
}

export async function setActivityStatus(id: string, status: string, actor: Actor) {
  return updateActivity(id, { status }, actor);
}

export async function softDelete(id: string, actor: Actor, confirm: boolean) {
  if (!confirm) throw new Error("Para apagar, envie confirm: true. A tarefa vai para a lixeira (dá para restaurar).");
  const before = await prisma.activity.findUnique({ where: { id } });
  if (!before || before.deletedAt) throw new ActivityNotFoundError("Tarefa não encontrada.");
  await closeOpenSession(id);
  const row = await prisma.activity.update({
    where: { id },
    data: { deletedAt: new Date(), queueOrder: null, updatedBy: actor.actorId ?? null },
    include: INCLUDE,
  });
  await emit({ activityId: id, type: "deleted", before: snap(before as never), after: snap(row as never), actor });
  return { activity: row, presented: present(row), voice: `Mandei '${row.title}' para a lixeira. Diga 'desfazer' se foi engano.` };
}

export async function restoreActivity(id: string, actor: Actor) {
  const before = await prisma.activity.findUnique({ where: { id } });
  if (!before) throw new ActivityNotFoundError("Tarefa não encontrada.");
  const row = await prisma.activity.update({
    where: { id },
    data: { deletedAt: null, updatedBy: actor.actorId ?? null },
    include: INCLUDE,
  });
  await emit({ activityId: id, type: "restored", before: snap(before as never), after: snap(row as never), actor });
  const st = await statuses();
  return { activity: row, presented: present(row, st.byKey.get(row.status)) };
}

export async function purgeDeleted(ids: string[] | undefined, actor: Actor) {
  const where = ids?.length ? { id: { in: ids }, deletedAt: { not: null } } : { deletedAt: { not: null } };
  const found = await prisma.activity.findMany({ where, select: { id: true, title: true } });
  await prisma.activity.deleteMany({ where });
  for (const row of found) {
    await writeAudit({ actorId: actor.actorId ?? null, actorType: "mcp", action: "activity_purged", entity: "Activity", entityId: row.id });
  }
  return { purged: found.length, titles: found.map((f) => f.title) };
}

export async function listTrash() {
  const st = await statuses();
  const rows = await prisma.activity.findMany({
    where: { deletedAt: { not: null } },
    include: INCLUDE,
    orderBy: { deletedAt: "desc" },
    take: 100,
  });
  return rows.map((r) => present(r, st.byKey.get(r.status)));
}

export async function queueAdd(ids: string[], position: number | undefined, actor: Actor, silent = false) {
  const max = await prisma.activity.aggregate({ _max: { queueOrder: true } });
  let next = position ?? (max._max.queueOrder ?? 0) + 1;
  for (const id of ids) {
    const before = await prisma.activity.findUnique({ where: { id } });
    if (!before || before.deletedAt || before.queueOrder != null) continue;
    const row = await prisma.activity.update({ where: { id }, data: { queueOrder: next++ } });
    if (!silent) await emit({ activityId: id, type: "queued", before: snap(before as never), after: snap(row as never), actor });
  }
  return getQueue();
}

export async function queueRemove(id: string, actor: Actor) {
  const before = await prisma.activity.findUnique({ where: { id } });
  if (!before) throw new ActivityNotFoundError("Tarefa não encontrada.");
  const row = await prisma.activity.update({ where: { id }, data: { queueOrder: null } });
  await emit({ activityId: id, type: "unqueued", before: snap(before as never), after: snap(row as never), actor });
  return getQueue();
}

export async function queueReorder(orderedIds: string[], actor: Actor) {
  for (let i = 0; i < orderedIds.length; i++) {
    const before = await prisma.activity.findUnique({ where: { id: orderedIds[i] } });
    await prisma.activity.update({ where: { id: orderedIds[i] }, data: { queueOrder: i + 1 } });
    if (before) await emit({ activityId: orderedIds[i], type: "reordered", before: snap(before as never), after: { queueOrder: i + 1 }, actor });
  }
  return getQueue();
}

export async function queueMove(id: string, to: number, actor: Actor) {
  const queue = await prisma.activity.findMany({
    where: { queueOrder: { not: null }, deletedAt: null },
    orderBy: { queueOrder: "asc" },
    select: { id: true },
  });
  const ids = queue.map((q) => q.id).filter((x) => x !== id);
  const idx = Math.max(0, Math.min(to - 1, ids.length));
  ids.splice(idx, 0, id);
  return queueReorder(ids, actor);
}

export async function getQueue() {
  const st = await statuses();
  const rows = await prisma.activity.findMany({
    where: { queueOrder: { not: null }, deletedAt: null },
    orderBy: { queueOrder: "asc" },
    include: INCLUDE,
  });
  return rows.map((r) => present(r, st.byKey.get(r.status)));
}

export async function rescheduleActivity(id: string, opts: { dueDate?: string; scheduledStart?: string; scheduledEnd?: string }, actor: Actor) {
  return updateActivity(id, opts, actor).then(async (res) => {
    await prisma.activityEvent.create({
      data: { activityId: id, type: "rescheduled", actorId: actor.actorId ?? null, source: actor.source || "ui" },
    });
    return res;
  });
}

export async function addReminder(id: string, remindAt: string, message: string, actor: Actor) {
  const parsed = parseDatePhrase(remindAt);
  if (!parsed) throw new Error("Não entendi a data do lembrete.");
  const row = await prisma.activityReminder.create({
    data: { activityId: id, remindAt: parsed.date, message: message || "", channel: "briefing" },
  });
  await emit({ activityId: id, type: "reminder_set", after: row, actor });
  return row;
}

export async function dismissReminder(id: string, actor: Actor) {
  const row = await prisma.activityReminder.update({
    where: { id },
    data: { dismissedAt: new Date() },
  });
  await emit({ activityId: row.activityId, type: "reminder_dismissed", after: row, actor });
  return row;
}

export async function addSubtask(parentId: string, title: string, actor: Actor) {
  return createActivity({ title, parentId, source: actor.source }, actor);
}

export async function getHistory(opts: { id?: string; date?: string }) {
  if (opts.id) {
    return prisma.activityEvent.findMany({
      where: { activityId: opts.id },
      orderBy: { at: "desc" },
      take: 50,
    });
  }
  const day = parseDatePhrase(opts.date || "hoje");
  const start = day?.date ?? new Date();
  const end = new Date(start.getTime() + 86400000);
  return prisma.activityEvent.findMany({
    where: { at: { gte: start, lt: end } },
    orderBy: { at: "desc" },
    take: 100,
  });
}

export async function undoLastAction(actor: Actor) {
  if (!actor.actorId) throw new Error("Sem ator para desfazer.");
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const ev = await prisma.activityEvent.findFirst({
    where: { actorId: actor.actorId, at: { gte: since }, type: { notIn: ["undo"] } },
    orderBy: { at: "desc" },
  });
  if (!ev) throw new Error("Nada para desfazer nos últimos 30 minutos.");
  if (ev.type === "created") {
    await prisma.activity.update({ where: { id: ev.activityId }, data: { deletedAt: new Date(), queueOrder: null } });
  } else if (ev.type === "deleted") {
    await prisma.activity.update({ where: { id: ev.activityId }, data: { deletedAt: null } });
  } else if (ev.before && typeof ev.before === "object") {
    const b = ev.before as Record<string, unknown>;
    await prisma.activity.update({
      where: { id: ev.activityId },
      data: {
        title: (b.title as string) ?? undefined,
        status: (b.status as string) ?? undefined,
        priority: (b.priority as string) ?? undefined,
        dueDate: b.dueDate ? new Date(String(b.dueDate)) : undefined,
        notes: (b.notes as string) ?? undefined,
        queueOrder: (b.queueOrder as number) ?? null,
        completedAt: b.completedAt ? new Date(String(b.completedAt)) : null,
        deletedAt: b.deletedAt ? new Date(String(b.deletedAt)) : null,
      },
    });
  }
  await emit({ activityId: ev.activityId, type: "undo", before: ev.after, after: ev.before, actor });
  const row = await prisma.activity.findUnique({ where: { id: ev.activityId }, include: INCLUDE });
  const st = await statuses();
  return { undone: ev.type, activity: row, presented: row ? present(row, st.byKey.get(row.status)) : null };
}

export async function listStatuses() {
  return prisma.activityStatus.findMany({ orderBy: { order: "asc" } });
}

export async function listTypes() {
  return prisma.activityType.findMany({ orderBy: { name: "asc" } });
}

export async function createType(name: string, color: string | undefined, actor: Actor) {
  const row = await prisma.activityType.create({ data: { name, color: color || "#6366f1" } });
  await writeAudit({ actorId: actor.actorId ?? null, actorType: "mcp", action: "activity_type_created", entity: "ActivityType", entityId: row.id });
  return row;
}

export function loadScoreMeta() {
  return daysUntilDue;
}

export { statuses as loadStatuses };
