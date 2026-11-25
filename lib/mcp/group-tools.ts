import { z } from "zod";
import { readMeta, writeMeta, type ToolServer } from "@/lib/mcp/annotations";
import {
  GroupError,
  asFlag,
  parseActivityIdList,
  parseGroupActivityQuery,
  parseGroupCreate,
  parseGroupPatch,
  type ActorRef,
  type GroupActivityQuery,
  type GroupInput,
  type GroupPatch,
} from "@/lib/activities/group-logic";

export type GroupToolApi = {
  list(opts: { includeArchived?: boolean; assignee?: string | null; actor: ActorRef }): Promise<unknown>;
  create(input: GroupInput, actor: ActorRef): Promise<unknown>;
  resolve(ref: { id?: string | null; name?: string | null }, actor: ActorRef): Promise<{ id: string }>;
  get(id: string, actor: ActorRef): Promise<unknown>;
  update(id: string, patch: GroupPatch, actor: ActorRef): Promise<unknown>;
  remove(id: string, opts: { archive: boolean }, actor: ActorRef): Promise<unknown>;
  add(groupId: string, activityIds: string[], actor: ActorRef): Promise<unknown>;
  removeActivities(groupId: string, activityIds: string[], actor: ActorRef): Promise<unknown>;
  listActivities(groupId: string, query: GroupActivityQuery, actor: ActorRef): Promise<unknown>;
};

const str = z.string().optional();

export const createGroupSchema = z.object({
  name: z.string(),
  description: str,
  color: str,
  icon: str,
  assignee_email: str,
  owner_email: str,
});

export const updateGroupSchema = z.object({
  id: str,
  name: str,
  description: str,
  color: str,
  icon: str,
  assignee_email: str,
  owner_email: str,
  archived: str,
});

export const deleteGroupSchema = z.object({
  id: str,
  name: str,
  archive: str,
  confirm: str,
});

export const listGroupsSchema = z.object({
  include_archived: str,
  assignee: str,
});

export const getGroupSchema = z.object({
  id: str,
  name: str,
});

export const membershipSchema = z.object({
  group_id: str,
  group_name: str,
  activity_ids: str,
});

export const listGroupActivitiesSchema = z.object({
  group_id: str,
  group_name: str,
  status: str,
  due_before: str,
  due_within_days: str,
  overdue: str,
  assignee: str,
});

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function allows(scopes: string[], needed: "read" | "write") {
  if (scopes.includes("admin")) return true;
  return scopes.includes(needed);
}

function actorOf(ctx: { profileId: string }, source?: unknown): ActorRef {
  return { actorId: ctx.profileId || null, source: source === "voz" ? "voz" : "mcp" };
}

async function run(fn: () => Promise<unknown>) {
  try {
    return text(await fn());
  } catch (error) {
    if (error instanceof GroupError || error instanceof Error) return text({ error: error.message });
    throw error;
  }
}

export function bindGroupTools(
  server: ToolServer,
  ctx: { profileId: string; scopes: string[] },
  api: GroupToolApi
) {
  const actor = (source?: unknown) => actorOf(ctx, source);

  server.registerTool("create_group", {
    ...writeMeta("Criar grupo"),
    description: "Cria um grupo de tarefas (ex.: Nuage, Pessoal, Acompanhamento David). O nome é único para o usuário. assignee_email ou owner_email é o responsável do grupo, não cria tarefas.",
    inputSchema: createGroupSchema,
  }, async (args) => {
    if (!allows(ctx.scopes, "write")) return text({ error: "Token sem permissão para esta tool" });
    return run(() => api.create(parseGroupCreate(args), actor(args.source)));
  });

  server.registerTool("update_group", {
    ...writeMeta("Editar grupo", { idempotent: true }),
    description: "Edita nome, descrição, cor, ícone, responsável (assignee_email ou owner_email) ou arquivamento (archived=true ou false) de um grupo. Informe id ou name.",
    inputSchema: updateGroupSchema,
  }, async (args) => {
    if (!allows(ctx.scopes, "write")) return text({ error: "Token sem permissão para esta tool" });
    return run(async () => {
      const group = await api.resolve({ id: args.id ? String(args.id) : null, name: args.name ? String(args.name) : null }, actor(args.source));
      const patch = parseGroupPatch({
        ...(args.name && args.id ? { name: args.name } : {}),
        description: args.description,
        color: args.color,
        icon: args.icon,
        assignee_email: args.assignee_email,
        owner_email: args.owner_email,
        archived: args.archived,
      });
      return api.update(group.id, patch, actor(args.source));
    });
  });

  server.registerTool("delete_group", {
    ...writeMeta("Apagar grupo", { destructive: true }),
    description: "Apaga o grupo e os vínculos. As tarefas NÃO são apagadas. Exige confirm=true. Com archive=true só arquiva, sem apagar o grupo nem as tarefas.",
    inputSchema: deleteGroupSchema,
  }, async (args) => {
    if (!allows(ctx.scopes, "write")) return text({ error: "Token sem permissão para esta tool" });
    return run(async () => {
      const archive = asFlag(args.archive);
      if (!archive && !asFlag(args.confirm)) {
        throw new GroupError("Para apagar o grupo, envie confirm=true. As tarefas não são apagadas. Use archive=true para só arquivar.");
      }
      const group = await api.resolve({ id: args.id ? String(args.id) : null, name: args.name ? String(args.name) : null }, actor(args.source));
      return api.remove(group.id, { archive }, actor(args.source));
    });
  });

  server.registerTool("list_groups", {
    ...readMeta("Listar grupos"),
    description: "Lista os grupos de tarefas do usuário, com openCount (abertas) e overdueCount (atrasadas). include_archived=true inclui arquivados. assignee filtra pelo e-mail do responsável.",
    inputSchema: listGroupsSchema,
  }, async (args) => {
    if (!allows(ctx.scopes, "read")) return text({ error: "Token sem permissão para esta tool" });
    return run(() => api.list({
      includeArchived: asFlag(args.include_archived),
      assignee: args.assignee ? String(args.assignee) : null,
      actor: actor(args.source),
    }));
  });

  server.registerTool("get_group", {
    ...readMeta("Ver grupo"),
    description: "Detalhe de um grupo pelo id ou pelo name, com contagem de tarefas abertas e atrasadas.",
    inputSchema: getGroupSchema,
  }, async (args) => {
    if (!allows(ctx.scopes, "read")) return text({ error: "Token sem permissão para esta tool" });
    return run(async () => {
      const group = await api.resolve({ id: args.id ? String(args.id) : null, name: args.name ? String(args.name) : null }, actor(args.source));
      return api.get(group.id, actor(args.source));
    });
  });

  server.registerTool("add_activities_to_group", {
    ...writeMeta("Colocar tarefas no grupo", { idempotent: true }),
    description: "Adiciona uma ou mais tarefas a um grupo. activity_ids aceita ids separados por vírgula ou um JSON array. Não duplica o vínculo e não apaga tarefas.",
    inputSchema: membershipSchema,
  }, async (args) => {
    if (!allows(ctx.scopes, "write")) return text({ error: "Token sem permissão para esta tool" });
    return run(async () => {
      const group = await api.resolve({
        id: args.group_id ? String(args.group_id) : null,
        name: args.group_name ? String(args.group_name) : null,
      }, actor(args.source));
      return api.add(group.id, parseActivityIdList(args.activity_ids), actor(args.source));
    });
  });

  server.registerTool("remove_activities_from_group", {
    ...writeMeta("Tirar tarefas do grupo", { idempotent: true }),
    description: "Remove uma ou mais tarefas do grupo. activity_ids aceita ids separados por vírgula ou um JSON array. As tarefas continuam existindo.",
    inputSchema: membershipSchema,
  }, async (args) => {
    if (!allows(ctx.scopes, "write")) return text({ error: "Token sem permissão para esta tool" });
    return run(async () => {
      const group = await api.resolve({
        id: args.group_id ? String(args.group_id) : null,
        name: args.group_name ? String(args.group_name) : null,
      }, actor(args.source));
      return api.removeActivities(group.id, parseActivityIdList(args.activity_ids), actor(args.source));
    });
  });

  server.registerTool("list_group_activities", {
    ...readMeta("Tarefas do grupo"),
    description: "Lista as tarefas de um grupo. Filtros: status (key, open, done ou all), due_before (AAAA-MM-DD), due_within_days (próximos N dias; 1 = hoje), overdue=true (atrasadas e ainda abertas), assignee (e-mail do responsável do grupo ou texto do campo aguardando da tarefa).",
    inputSchema: listGroupActivitiesSchema,
  }, async (args) => {
    if (!allows(ctx.scopes, "read")) return text({ error: "Token sem permissão para esta tool" });
    return run(async () => {
      const group = await api.resolve({
        id: args.group_id ? String(args.group_id) : null,
        name: args.group_name ? String(args.group_name) : null,
      }, actor(args.source));
      return api.listActivities(group.id, parseGroupActivityQuery(args), actor(args.source));
    });
  });
}
