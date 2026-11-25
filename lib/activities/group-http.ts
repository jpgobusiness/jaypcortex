import { badRequest, conflict, notFound, ok, serverError } from "@/lib/api";
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
} from "./group-logic";

export type GroupApi = {
  list(opts: { includeArchived?: boolean; assignee?: string | null; actor: ActorRef }): Promise<unknown>;
  create(input: GroupInput, actor: ActorRef): Promise<unknown>;
  get(id: string, actor: ActorRef): Promise<unknown>;
  update(id: string, patch: GroupPatch, actor: ActorRef): Promise<unknown>;
  remove(id: string, opts: { archive: boolean }, actor: ActorRef): Promise<unknown>;
  add(groupId: string, activityIds: string[], actor: ActorRef): Promise<unknown>;
  removeActivities(groupId: string, activityIds: string[], actor: ActorRef): Promise<unknown>;
  listActivities(groupId: string, query: GroupActivityQuery, actor: ActorRef): Promise<unknown>;
  defaults(actor: ActorRef): Promise<unknown>;
};

export function groupHttpError(error: unknown) {
  if (error instanceof GroupError) {
    if (error.status === 404) return notFound(error.message);
    if (error.status === 409) return conflict({ error: error.message });
    return badRequest(error.message);
  }
  return serverError(error);
}

async function readBody(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new GroupError("Corpo da requisição inválido");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof GroupError) throw error;
    throw new GroupError("Corpo da requisição inválido");
  }
}

export async function handleListGroups(req: Request, api: GroupApi, actor: ActorRef) {
  try {
    const url = new URL(req.url);
    const groups = await api.list({
      includeArchived: url.searchParams.get("includeArchived") === "1" || asFlag(url.searchParams.get("includeArchived")),
      assignee: url.searchParams.get("assignee"),
      actor,
    });
    return ok(groups);
  } catch (error) {
    return groupHttpError(error);
  }
}

export async function handleCreateGroup(req: Request, api: GroupApi, actor: ActorRef) {
  try {
    const body = await readBody(req);
    if (body.defaults === true) return ok(await api.defaults(actor), 201);
    return ok(await api.create(parseGroupCreate(body), actor), 201);
  } catch (error) {
    return groupHttpError(error);
  }
}

export async function handleGetGroup(_req: Request, id: string, api: GroupApi, actor: ActorRef) {
  try {
    return ok(await api.get(id, actor));
  } catch (error) {
    return groupHttpError(error);
  }
}

export async function handleUpdateGroup(req: Request, id: string, api: GroupApi, actor: ActorRef) {
  try {
    const body = await readBody(req);
    return ok(await api.update(id, parseGroupPatch(body), actor));
  } catch (error) {
    return groupHttpError(error);
  }
}

export async function handleDeleteGroup(req: Request, id: string, api: GroupApi, actor: ActorRef) {
  try {
    const url = new URL(req.url);
    const archive = url.searchParams.get("archive") === "1" || asFlag(url.searchParams.get("archive"));
    return ok(await api.remove(id, { archive }, actor));
  } catch (error) {
    return groupHttpError(error);
  }
}

export async function handleListGroupActivities(req: Request, id: string, api: GroupApi, actor: ActorRef) {
  try {
    const url = new URL(req.url);
    const query = parseGroupActivityQuery({
      status: url.searchParams.get("status") ?? undefined,
      due: url.searchParams.get("due") ?? undefined,
      withinDays: url.searchParams.get("withinDays") ?? undefined,
      dueBefore: url.searchParams.get("dueBefore") ?? undefined,
      assignee: url.searchParams.get("assignee") ?? undefined,
      overdue: url.searchParams.get("overdue") ?? undefined,
    });
    return ok(await api.listActivities(id, query, actor));
  } catch (error) {
    return groupHttpError(error);
  }
}

export async function handleAddGroupActivities(req: Request, id: string, api: GroupApi, actor: ActorRef) {
  try {
    const body = await readBody(req);
    const ids = parseActivityIdList(body.activityIds ?? body.activityId);
    return ok(await api.add(id, ids, actor), 201);
  } catch (error) {
    return groupHttpError(error);
  }
}

export async function handleRemoveGroupActivities(req: Request, id: string, api: GroupApi, actor: ActorRef) {
  try {
    const url = new URL(req.url);
    let ids = parseActivityIdList(url.searchParams.get("activityIds"));
    if (!ids.length && req.headers.get("content-type")?.includes("application/json")) {
      const body = await readBody(req);
      ids = parseActivityIdList(body.activityIds ?? body.activityId);
    }
    return ok(await api.removeActivities(id, ids, actor));
  } catch (error) {
    return groupHttpError(error);
  }
}
