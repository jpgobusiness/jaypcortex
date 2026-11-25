import { bindGroupTools, type GroupToolApi } from "@/lib/mcp/group-tools";
import {
  addActivitiesToGroup,
  createGroup,
  getGroup,
  listGroupActivities,
  listGroups,
  removeActivitiesFromGroup,
  removeGroup,
  resolveGroup,
  updateGroup,
} from "@/lib/activities/groups";
import type { ToolServer } from "@/lib/mcp/annotations";

const api: GroupToolApi = {
  list: (opts) => listGroups(opts),
  create: (input, actor) => createGroup(input, actor),
  resolve: async (ref, actor) => resolveGroup(ref, actor),
  get: (id, actor) => getGroup(id, actor),
  update: (id, patch, actor) => updateGroup(id, patch, actor),
  remove: (id, opts, actor) => removeGroup(id, opts, actor),
  add: (groupId, ids, actor) => addActivitiesToGroup(groupId, ids, actor),
  removeActivities: (groupId, ids, actor) => removeActivitiesFromGroup(groupId, ids, actor),
  listActivities: (groupId, query, actor) => listGroupActivities(groupId, query, actor),
};

export function registerGroupTools(
  server: ToolServer,
  ctx: { profileId: string; scopes: string[] }
) {
  bindGroupTools(server, ctx, api);
}
