import { prisma } from "@/lib/prisma";
import { civilUtc, zonedParts } from "./dates";
import {
  DEFAULT_ACTIVITY_GROUPS,
  GroupError,
  activityGroupInclude,
  buildGroupActivityWhere,
  countGroupActivityStats,
  groupRemovalResult,
  membershipChangeResult,
  parseActivityIdList,
  visibleGroups,
  withGroupFields,
  type ActorRef,
  type GroupActivityQuery,
  type GroupInput,
  type GroupPatch,
} from "./group-logic";

export { activityGroupInclude, withGroupFields, GroupError, parseActivityIdList, visibleGroups };

function todayStart(now = new Date()) {
  const parts = zonedParts(now);
  return civilUtc(parts.y, parts.m, parts.d);
}

async function doneKeys() {
  const rows = await prisma.activityStatus.findMany({ select: { key: true, isDone: true } });
  return rows.filter((row) => row.isDone).map((row) => row.key);
}

function presentGroup(
  row: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    icon: string | null;
    assigneeEmail: string | null;
    ownerId: string | null;
    archived: boolean;
    createdAt: Date;
    updatedAt: Date;
    members?: { activity: { status: string; dueDate: Date | null } }[];
  },
  keys: string[],
  start: Date
) {
  const stats = countGroupActivityStats(
    (row.members ?? []).map((member) => member.activity),
    keys,
    start
  );
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    assigneeEmail: row.assigneeEmail,
    ownerEmail: row.assigneeEmail,
    ownerId: row.ownerId,
    archived: row.archived,
    openCount: stats.open,
    overdueCount: stats.overdue,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const GROUP_INCLUDE = {
  members: {
    where: { activity: { deletedAt: null } },
    select: { activity: { select: { status: true, dueDate: true } } },
  },
} as const;

async function claimUnowned(actor: ActorRef) {
  if (!actor.actorId) return;
  await prisma.activityGroup.updateMany({
    where: { ownerId: null },
    data: { ownerId: actor.actorId },
  });
}

function assertOwner(group: { ownerId: string | null }, actor: ActorRef) {
  if (actor.actorId && group.ownerId && group.ownerId !== actor.actorId) {
    throw new GroupError("Grupo não encontrado", 404);
  }
}

async function findOwned(id: string, actor: ActorRef) {
  const group = await prisma.activityGroup.findUnique({ where: { id }, include: GROUP_INCLUDE });
  if (!group) throw new GroupError("Grupo não encontrado", 404);
  assertOwner(group, actor);
  return group;
}

async function assertUniqueName(name: string, actor: ActorRef, exceptId?: string) {
  const existing = await prisma.activityGroup.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ownerId: actor.actorId ?? null,
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true, name: true },
  });
  if (existing) throw new GroupError(`Já existe um grupo chamado "${existing.name}"`, 409);
}

export async function ensureDefaultGroups(ownerId: string | null) {
  const out = [];
  for (const item of DEFAULT_ACTIVITY_GROUPS) {
    const byName = await prisma.activityGroup.findFirst({
      where: {
        name: { equals: item.name, mode: "insensitive" },
        ...(ownerId ? { OR: [{ ownerId }, { ownerId: null }] } : { ownerId: null }),
      },
    });
    if (byName) {
      if (ownerId && !byName.ownerId) {
        out.push(await prisma.activityGroup.update({
          where: { id: byName.id },
          data: { ownerId, assigneeEmail: byName.assigneeEmail ?? item.assigneeEmail },
        }));
      } else {
        out.push(byName);
      }
      continue;
    }
    out.push(await prisma.activityGroup.create({
      data: {
        id: item.id,
        name: item.name,
        color: item.color,
        icon: item.icon,
        assigneeEmail: item.assigneeEmail,
        ownerId,
      },
    }));
  }
  return out;
}

export async function listGroups(opts: { includeArchived?: boolean; assignee?: string | null; actor: ActorRef }) {
  await claimUnowned(opts.actor);
  const keys = await doneKeys();
  const start = todayStart();
  const rows = await prisma.activityGroup.findMany({
    where: {
      ...(opts.includeArchived ? {} : { archived: false }),
      ...(opts.actor.actorId ? { ownerId: opts.actor.actorId } : {}),
      ...(opts.assignee ? { assigneeEmail: { contains: opts.assignee, mode: "insensitive" } } : {}),
    },
    include: GROUP_INCLUDE,
    orderBy: { name: "asc" },
  });
  return rows.map((row) => presentGroup(row, keys, start));
}

export async function createGroup(input: GroupInput, actor: ActorRef) {
  await assertUniqueName(input.name, actor);
  try {
    const row = await prisma.activityGroup.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? "#6366f1",
        icon: input.icon ?? null,
        assigneeEmail: input.assigneeEmail ?? null,
        ownerId: actor.actorId ?? null,
      },
      include: GROUP_INCLUDE,
    });
    return presentGroup(row, await doneKeys(), todayStart());
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new GroupError(`Já existe um grupo chamado "${input.name}"`, 409);
    }
    throw error;
  }
}

export async function getGroup(id: string, actor: ActorRef) {
  const row = await findOwned(id, actor);
  return presentGroup(row, await doneKeys(), todayStart());
}

export async function resolveGroup(ref: { id?: string | null; name?: string | null }, actor: ActorRef) {
  if (ref.id) return findOwned(ref.id, actor);
  const name = ref.name?.trim();
  if (!name) throw new GroupError("Informe o grupo (id ou nome)");
  const row = await prisma.activityGroup.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(actor.actorId ? { ownerId: actor.actorId } : {}),
    },
    include: GROUP_INCLUDE,
  });
  if (!row) throw new GroupError("Grupo não encontrado", 404);
  assertOwner(row, actor);
  return row;
}

export async function updateGroup(id: string, patch: GroupPatch, actor: ActorRef) {
  await findOwned(id, actor);
  if (patch.name) await assertUniqueName(patch.name, actor, id);
  const row = await prisma.activityGroup.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
      ...(patch.assigneeEmail !== undefined ? { assigneeEmail: patch.assigneeEmail } : {}),
      ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
    },
    include: GROUP_INCLUDE,
  });
  return presentGroup(row, await doneKeys(), todayStart());
}

export async function removeGroup(id: string, opts: { archive: boolean }, actor: ActorRef) {
  const group = await findOwned(id, actor);
  if (opts.archive) {
    await prisma.activityGroup.update({ where: { id: group.id }, data: { archived: true } });
    return groupRemovalResult({ archived: true, membershipsRemoved: 0 });
  }
  const membershipsRemoved = await prisma.activityGroupMember.count({ where: { groupId: group.id } });
  await prisma.activityGroup.delete({ where: { id: group.id } });
  return groupRemovalResult({ archived: false, membershipsRemoved });
}

async function activityIdsOrThrow(ids: string[]) {
  const unique = parseActivityIdList(ids);
  if (!unique.length) throw new GroupError("Informe ao menos uma atividade");
  const found = await prisma.activity.findMany({
    where: { id: { in: unique }, deletedAt: null },
    select: { id: true },
  });
  const have = new Set(found.map((row) => row.id));
  const missing = unique.filter((id) => !have.has(id));
  if (missing.length) throw new GroupError(`Atividade não encontrada: ${missing.join(", ")}`, 404);
  return unique;
}

export async function addActivitiesToGroup(groupId: string, activityIds: string[], actor: ActorRef) {
  const group = await findOwned(groupId, actor);
  const ids = await activityIdsOrThrow(activityIds);
  const result = await prisma.activityGroupMember.createMany({
    data: ids.map((activityId) => ({ activityId, groupId: group.id })),
    skipDuplicates: true,
  });
  return membershipChangeResult("added", group.id, ids, result.count);
}

export async function removeActivitiesFromGroup(groupId: string, activityIds: string[], actor: ActorRef) {
  const group = await findOwned(groupId, actor);
  const ids = parseActivityIdList(activityIds);
  if (!ids.length) throw new GroupError("Informe ao menos uma atividade");
  const result = await prisma.activityGroupMember.deleteMany({
    where: { groupId: group.id, activityId: { in: ids } },
  });
  return membershipChangeResult("removed", group.id, ids, result.count);
}

async function assertGroups(ids: string[], actor: ActorRef) {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return [];
  const groups = await prisma.activityGroup.findMany({ where: { id: { in: unique } } });
  if (groups.length !== unique.length) throw new GroupError("Grupo não encontrado", 404);
  for (const group of groups) assertOwner(group, actor);
  return unique;
}

export async function attachActivityGroups(activityId: string, groupIds: string[], actor: ActorRef) {
  const ids = await assertGroups(groupIds, actor);
  if (!ids.length) return;
  await prisma.activityGroupMember.createMany({
    data: ids.map((groupId) => ({ activityId, groupId })),
    skipDuplicates: true,
  });
}

export async function setActivityGroups(activityId: string, groupIds: string[], actor: ActorRef) {
  const ids = await assertGroups(groupIds, actor);
  await prisma.activityGroupMember.deleteMany({
    where: ids.length ? { activityId, groupId: { notIn: ids } } : { activityId },
  });
  if (!ids.length) return;
  await prisma.activityGroupMember.createMany({
    data: ids.map((groupId) => ({ activityId, groupId })),
    skipDuplicates: true,
  });
}

export async function listGroupActivities(groupId: string, query: GroupActivityQuery, actor: ActorRef) {
  const group = await findOwned(groupId, actor);
  const keys = await doneKeys();
  const start = todayStart();
  const where = buildGroupActivityWhere({
    groupId: group.id,
    doneKeys: keys,
    todayStart: start,
    query,
    groupAssignee: group.assigneeEmail,
  });
  const rows = await prisma.activity.findMany({
    where,
    include: activityGroupInclude,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  const activities = rows.map((row) => {
    const shaped = withGroupFields(row);
    return {
      id: shaped.id,
      title: shaped.title,
      status: shaped.status,
      priority: shaped.priority,
      dueDate: shaped.dueDate,
      waitingOn: shaped.waitingOn,
      groupIds: shaped.groupIds,
      groupNames: shaped.groupNames,
    };
  });
  return {
    group: presentGroup(group, keys, start),
    activities,
    total: activities.length,
  };
}
