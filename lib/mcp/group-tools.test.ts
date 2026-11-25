import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { jsonSchemaTypeIssues } from "./activity-schemas";
import {
  bindGroupTools,
  createGroupSchema,
  deleteGroupSchema,
  listGroupActivitiesSchema,
  membershipSchema,
  updateGroupSchema,
  type GroupToolApi,
} from "./group-tools";
import type { ToolServer } from "./annotations";

function harness(scopes: string[]) {
  const tools = new Map<string, { description: string; schema: z.ZodType; handler: (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }> }>();
  const calls: { name: string; args: unknown[] }[] = [];
  const api: GroupToolApi = {
    list: async (opts) => {
      calls.push({ name: "list", args: [opts] });
      return [{ name: "Nuage", openCount: 1, overdueCount: 0 }];
    },
    create: async (input) => {
      calls.push({ name: "create", args: [input] });
      return { id: "grp_david", ...input };
    },
    resolve: async (ref) => {
      calls.push({ name: "resolve", args: [ref] });
      return { id: ref.id || "grp_david", name: ref.name || "Acompanhamento David" };
    },
    get: async (id) => ({ id, name: "Acompanhamento David", openCount: 0, overdueCount: 0 }),
    update: async (id, patch) => {
      calls.push({ name: "update", args: [id, patch] });
      return { id, ...patch };
    },
    remove: async (id, opts) => {
      calls.push({ name: "remove", args: [id, opts] });
      return { deleted: !opts.archive, archived: opts.archive, activitiesDeleted: 0, membershipsRemoved: opts.archive ? 0 : 2 };
    },
    add: async (groupId, activityIds) => {
      calls.push({ name: "add", args: [groupId, activityIds] });
      return { groupId, added: activityIds.length, activityIds, activitiesDeleted: 0 };
    },
    removeActivities: async (groupId, activityIds) => ({
      groupId,
      removed: activityIds.length,
      activityIds,
      activitiesDeleted: 0,
    }),
    listActivities: async (groupId, query) => {
      calls.push({ name: "listActivities", args: [groupId, query] });
      return { group: { id: groupId }, activities: [], total: 0 };
    },
  };
  const server: ToolServer = {
    registerTool(name, config, handler) {
      tools.set(name, {
        description: config.description,
        schema: config.inputSchema as z.ZodType,
        handler,
      });
    },
  };
  bindGroupTools(server, { profileId: "user-1", scopes }, api);
  return { tools, calls };
}

function payload(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

test("tools de grupo têm descrição em português e schema só de string", () => {
  const { tools } = harness(["read", "write"]);
  const names = [
    "create_group", "update_group", "delete_group", "list_groups", "get_group",
    "add_activities_to_group", "remove_activities_from_group", "list_group_activities",
  ];
  assert.deepEqual([...tools.keys()], names);
  for (const name of names) {
    const tool = tools.get(name)!;
    assert.match(tool.description, /grupo|tarefa/i, name);
    assert.doesNotMatch(tool.description, /\b(create|delete|list)\b/i, name);
    const schema = z.toJSONSchema(tool.schema) as { properties?: Record<string, { type?: unknown }> };
    assert.deepEqual(jsonSchemaTypeIssues(schema), [], name);
    for (const [field, spec] of Object.entries(schema.properties || {})) {
      assert.equal(spec.type, "string", `${name}.${field}`);
    }
  }
  assert.match(tools.get("delete_group")!.description, /NÃO são apagadas/);
  assert.match(tools.get("list_group_activities")!.description, /due_within_days/);
  assert.match(tools.get("list_group_activities")!.description, /overdue/);
});

test("create_group grava responsável e delete_group exige confirm", async () => {
  const { tools, calls } = harness(["write"]);
  const created = payload(await tools.get("create_group")!.handler({
    name: "Acompanhamento David",
    owner_email: "dpsilva@nuageit.com.br",
  }));
  assert.equal(created.assigneeEmail, "dpsilva@nuageit.com.br");
  assert.equal(calls[0].name, "create");

  const blocked = payload(await tools.get("delete_group")!.handler({ id: "grp_david" }));
  assert.match(String(blocked.error), /confirm=true/);
  assert.equal(calls.some((call) => call.name === "remove"), false);

  const removed = payload(await tools.get("delete_group")!.handler({ id: "grp_david", confirm: "true" }));
  assert.equal(removed.activitiesDeleted, 0);
  assert.equal(removed.deleted, true);
});

test("list_group_activities repassa filtros e lote entra no grupo", async () => {
  const { tools, calls } = harness(["read", "write"]);
  await tools.get("list_group_activities")!.handler({
    group_id: "grp_david",
    status: "open",
    due_within_days: "5",
    overdue: "true",
    due_before: "2026-12-01",
    assignee: "dpsilva",
  });
  const query = calls.find((call) => call.name === "listActivities")?.args[1] as {
    status: string;
    dueWithinDays: number;
    overdue: boolean;
    assignee: string;
  };
  assert.equal(query.status, "open");
  assert.equal(query.dueWithinDays, 5);
  assert.equal(query.overdue, true);
  assert.equal(query.assignee, "dpsilva");

  const added = payload(await tools.get("add_activities_to_group")!.handler({
    group_name: "Nuage",
    activity_ids: "a,b",
  }));
  assert.equal(added.activitiesDeleted, 0);
  assert.deepEqual(added.activityIds, ["a", "b"]);
});

test("schemas publicados continuam só string", () => {
  for (const schema of [createGroupSchema, updateGroupSchema, deleteGroupSchema, membershipSchema, listGroupActivitiesSchema]) {
    const json = z.toJSONSchema(schema) as { properties?: Record<string, { type?: unknown }> };
    assert.deepEqual(jsonSchemaTypeIssues(json), []);
  }
});

test("leitura não cria grupo", async () => {
  const { tools } = harness(["read"]);
  const result = payload(await tools.get("create_group")!.handler({ name: "Nuage" }));
  assert.match(String(result.error), /permissão/);
});
