import {
  addActivitiesToGroup,
  createGroup,
  ensureDefaultGroups,
  getGroup,
  listGroupActivities,
  listGroups,
  removeActivitiesFromGroup,
  removeGroup,
  updateGroup,
} from "@/lib/activities/groups";
import {
  handleCreateGroup,
  handleListGroups,
  type GroupApi,
} from "@/lib/activities/group-http";
import { requestActor } from "@/lib/activities/actor-http";

const api: GroupApi = {
  list: (opts) => listGroups(opts),
  create: (input, actor) => createGroup(input, actor),
  get: (id, actor) => getGroup(id, actor),
  update: (id, patch, actor) => updateGroup(id, patch, actor),
  remove: (id, opts, actor) => removeGroup(id, opts, actor),
  add: (groupId, activityIds, actor) => addActivitiesToGroup(groupId, activityIds, actor),
  removeActivities: (groupId, activityIds, actor) => removeActivitiesFromGroup(groupId, activityIds, actor),
  listActivities: (groupId, query, actor) => listGroupActivities(groupId, query, actor),
  defaults: async (actor) => ensureDefaultGroups(actor.actorId ?? null),
};

export async function GET(req: Request) {
  return handleListGroups(req, api, await requestActor());
}

export async function POST(req: Request) {
  return handleCreateGroup(req, api, await requestActor());
}
