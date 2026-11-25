/** Regras de grupo sem banco: validação, filtros e o contrato de que apagar grupo não apaga tarefa. */

export type ActorRef = { actorId?: string | null; source?: string };

export class GroupError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "GroupError";
    this.status = status;
  }
}

export type GroupInput = {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  assigneeEmail?: string | null;
};

export type GroupPatch = {
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  assigneeEmail?: string | null;
  archived?: boolean;
};

export type GroupActivityQuery = {
  status?: string | null;
  dueBefore?: Date | null;
  dueWithinDays?: number | null;
  overdue?: boolean;
  today?: boolean;
  assignee?: string | null;
};

export const DEFAULT_ACTIVITY_GROUPS = [
  { id: "grp_nuage", name: "Nuage", color: "#6366f1", icon: "briefcase", assigneeEmail: null },
  { id: "grp_pessoal", name: "Pessoal", color: "#16a34a", icon: "user", assigneeEmail: null },
  { id: "grp_david", name: "Acompanhamento David", color: "#d97706", icon: "users", assigneeEmail: "dpsilva@nuageit.com.br" },
] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function asFlag(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

export function parseActivityIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        return parseActivityIdList(JSON.parse(trimmed) as unknown);
      } catch {
        throw new GroupError("activityIds precisa ser uma lista de ids");
      }
    }
    return [...new Set(trimmed.split(/[,;\s]+/).map((part) => part.trim()).filter(Boolean))];
  }
  return [];
}

function optionalText(value: unknown, label: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) throw new GroupError(`${label} deve ter no máximo ${max} caracteres`);
  return text;
}

function optionalEmail(raw: Record<string, unknown>): string | null | undefined {
  const present = ["assigneeEmail", "assignee_email", "ownerEmail", "owner_email", "assignee"].find(
    (key) => raw[key] !== undefined
  );
  if (!present) return undefined;
  const value = raw[present];
  if (value === null || String(value).trim() === "") return null;
  const email = String(value).trim().toLowerCase();
  if (!EMAIL.test(email)) throw new GroupError("E-mail do responsável inválido");
  return email;
}

function readName(raw: Record<string, unknown>, required: boolean): string | undefined {
  if (raw.name === undefined || raw.name === null || String(raw.name).trim() === "") {
    if (required) throw new GroupError("Nome do grupo é obrigatório");
    return undefined;
  }
  const name = String(raw.name).trim();
  if (name.length > 80) throw new GroupError("Nome do grupo deve ter no máximo 80 caracteres");
  return name;
}

export function parseGroupCreate(raw: Record<string, unknown>): GroupInput {
  const name = readName(raw, true);
  return {
    name: name!,
    description: optionalText(raw.description, "Descrição", 500) ?? null,
    color: optionalText(raw.color, "Cor", 32) ?? null,
    icon: optionalText(raw.icon, "Ícone", 40) ?? null,
    assigneeEmail: optionalEmail(raw) ?? null,
  };
}

export function parseGroupPatch(raw: Record<string, unknown>): GroupPatch {
  const patch: GroupPatch = {};
  const name = readName(raw, false);
  if (name) patch.name = name;
  const description = optionalText(raw.description, "Descrição", 500);
  if (description !== undefined) patch.description = description;
  const color = optionalText(raw.color, "Cor", 32);
  if (color !== undefined) patch.color = color;
  const icon = optionalText(raw.icon, "Ícone", 40);
  if (icon !== undefined) patch.icon = icon;
  const email = optionalEmail(raw);
  if (email !== undefined) patch.assigneeEmail = email;
  if (raw.archived !== undefined) patch.archived = asFlag(raw.archived);
  if (!Object.keys(patch).length) throw new GroupError("Nada para atualizar no grupo");
  return patch;
}

export function parseCivilDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) throw new GroupError("Data inválida. Use AAAA-MM-DD");
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function parseGroupActivityQuery(raw: Record<string, unknown>): GroupActivityQuery {
  const query: GroupActivityQuery = {};
  if (raw.status) query.status = String(raw.status).trim();
  const due = raw.due ? String(raw.due).trim().toLowerCase() : "";
  if (due === "overdue" || asFlag(raw.overdue)) query.overdue = true;
  if (due === "today") query.today = true;
  const within = raw.dueWithinDays ?? raw.due_within_days ?? raw.withinDays;
  if (within !== undefined && String(within).trim() !== "") {
    const days = Number(within);
    if (!Number.isInteger(days) || days < 1 || days > 366) {
      throw new GroupError("due_within_days deve ser um inteiro de 1 a 366");
    }
    query.dueWithinDays = days;
  }
  const before = raw.dueBefore ?? raw.due_before;
  if (before !== undefined && String(before).trim() !== "") query.dueBefore = parseCivilDate(String(before));
  const assignee = raw.assignee ?? raw.assignee_email ?? raw.owner_email;
  if (assignee !== undefined && String(assignee).trim() !== "") query.assignee = String(assignee).trim();
  return query;
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

export function buildGroupActivityWhere(input: {
  groupId: string;
  doneKeys: string[];
  todayStart: Date;
  query: GroupActivityQuery;
  groupAssignee?: string | null;
}) {
  const doneKeys = input.doneKeys.length ? input.doneKeys : ["done"];
  const where: Record<string, unknown> = {
    deletedAt: null,
    groupMemberships: { some: { groupId: input.groupId } },
  };
  const status = input.query.status;
  if (input.query.overdue) {
    where.dueDate = { lt: input.todayStart };
    where.status = { notIn: doneKeys };
  } else if (status === "open") {
    where.status = { notIn: doneKeys };
  } else if (status === "done") {
    where.status = { in: doneKeys };
  } else if (status && status !== "all") {
    where.status = status;
  }
  if (!input.query.overdue && input.query.today) {
    where.dueDate = { gte: input.todayStart, lt: addUtcDays(input.todayStart, 1) };
  } else if (!input.query.overdue && input.query.dueWithinDays) {
    where.dueDate = { gte: input.todayStart, lt: addUtcDays(input.todayStart, input.query.dueWithinDays) };
  } else if (!input.query.overdue && input.query.dueBefore) {
    where.dueDate = { lt: input.query.dueBefore };
  }
  const assignee = input.query.assignee?.trim();
  if (assignee) {
    const groupHit = input.groupAssignee?.toLowerCase().includes(assignee.toLowerCase());
    if (!groupHit) where.waitingOn = { contains: assignee, mode: "insensitive" };
  }
  return where;
}

export function countGroupActivityStats(
  rows: { status: string; dueDate: Date | string | null }[],
  doneKeys: string[],
  todayStart: Date
) {
  const done = new Set(doneKeys);
  let open = 0;
  let overdue = 0;
  for (const row of rows) {
    if (done.has(row.status)) continue;
    open += 1;
    if (row.dueDate && new Date(row.dueDate).getTime() < todayStart.getTime()) overdue += 1;
  }
  return { open, overdue };
}

export function groupRemovalResult(opts: { archived: boolean; membershipsRemoved: number }) {
  return {
    deleted: !opts.archived,
    archived: opts.archived,
    activitiesDeleted: 0 as const,
    membershipsRemoved: opts.archived ? 0 : opts.membershipsRemoved,
  };
}

export function membershipChangeResult(
  kind: "added" | "removed",
  groupId: string,
  activityIds: string[],
  count: number
) {
  return {
    groupId,
    [kind]: count,
    activityIds,
    activitiesDeleted: 0 as const,
  };
}

export type GroupRef = {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  archived?: boolean;
};

export function visibleGroups(memberships: { group: GroupRef }[] | null | undefined) {
  return (memberships ?? []).map((member) => member.group).filter((group) => !group.archived);
}

export function withGroupFields<T extends { groupMemberships?: { group: GroupRef }[] | null }>(row: T) {
  const groups = visibleGroups(row.groupMemberships).map((group) => ({
    id: group.id,
    name: group.name,
    color: group.color ?? null,
    icon: group.icon ?? null,
  }));
  const { groupMemberships, ...rest } = row;
  void groupMemberships;
  return {
    ...rest,
    groups,
    groupIds: groups.map((group) => group.id),
    groupNames: groups.map((group) => group.name),
  };
}

export const activityGroupInclude = {
  groupMemberships: {
    include: {
      group: { select: { id: true, name: true, color: true, icon: true, archived: true } },
    },
  },
} as const;
