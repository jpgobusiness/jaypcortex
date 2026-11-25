import assert from "node:assert/strict";
import { test } from "node:test";
import {
  handleAddGroupActivities,
  handleCreateGroup,
  handleDeleteGroup,
  handleListGroupActivities,
  handleListGroups,
  handleRemoveGroupActivities,
  type GroupApi,
} from "./group-http";
import type { ActorRef } from "./group-logic";

const actor: ActorRef = { actorId: "user-1", source: "ui" };

function api(overrides: Partial<GroupApi> = {}): GroupApi & { calls: { name: string; args: unknown[] }[] } {
  const calls: { name: string; args: unknown[] }[] = [];
  const record = <T>(name: string, value: T) => (...args: unknown[]) => {
    calls.push({ name, args });
    return Promise.resolve(value);
  };
  return {
    calls,
    list: record("list", [{ id: "grp_nuage", name: "Nuage", openCount: 2, overdueCount: 1 }]),
    create: record("create", { id: "g1", name: "Nuage" }),
    get: record("get", { id: "g1" }),
    update: record("update", { id: "g1" }),
    remove: record("remove", { deleted: true, archived: false, activitiesDeleted: 0, membershipsRemoved: 3 }),
    add: record("add", { added: 2, activitiesDeleted: 0 }),
    removeActivities: record("removeActivities", { removed: 1, activitiesDeleted: 0 }),
    listActivities: record("listActivities", { activities: [], total: 0 }),
    defaults: record("defaults", [{ name: "Nuage" }, { name: "Pessoal" }, { name: "Acompanhamento David" }]),
    ...overrides,
  };
}

test("GET /api/activity-groups lista com arquivo e responsável", async () => {
  const service = api();
  const res = await handleListGroups(
    new Request("http://local/api/activity-groups?includeArchived=1&assignee=david"),
    service,
    actor
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body[0].openCount, 2);
  assert.equal(body[0].overdueCount, 1);
  assert.deepEqual(service.calls[0].args[0], {
    includeArchived: true,
    assignee: "david",
    actor,
  });
});

test("POST /api/activity-groups cria e recusa nome vazio", async () => {
  const service = api();
  const created = await handleCreateGroup(
    new Request("http://local/api/activity-groups", {
      method: "POST",
      body: JSON.stringify({ name: "Pessoal", color: "#16a34a" }),
    }),
    service,
    actor
  );
  assert.equal(created.status, 201);

  const missing = await handleCreateGroup(
    new Request("http://local/api/activity-groups", {
      method: "POST",
      body: JSON.stringify({ color: "#16a34a" }),
    }),
    service,
    actor
  );
  assert.equal(missing.status, 400);
});

test("POST /api/activity-groups nome duplicado responde 409", async () => {
  const service = api({
    create: async () => {
      const { GroupError } = await import("./group-logic");
      throw new GroupError('Já existe um grupo chamado "Nuage"', 409);
    },
  });
  const res = await handleCreateGroup(
    new Request("http://local/api/activity-groups", {
      method: "POST",
      body: JSON.stringify({ name: "Nuage" }),
    }),
    service,
    actor
  );
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.match(body.error, /Nuage/);
});

test("DELETE /api/activity-groups/:id apaga vínculos e preserva atividades; archive=1 arquiva", async () => {
  const service = api();
  const removed = await handleDeleteGroup(new Request("http://local/api/activity-groups/grp_nuage"), "grp_nuage", service, actor);
  assert.equal(removed.status, 200);
  const body = await removed.json();
  assert.equal(body.activitiesDeleted, 0);
  assert.equal(body.membershipsRemoved, 3);
  assert.deepEqual(service.calls[0].args[1], { archive: false });

  const archived = await handleDeleteGroup(
    new Request("http://local/api/activity-groups/grp_nuage?archive=1"),
    "grp_nuage",
    service,
    actor
  );
  assert.equal(archived.status, 200);
  assert.deepEqual(service.calls[1].args[1], { archive: true });
});

test("GET/POST/DELETE /api/activity-groups/:id/activities filtra prazo e aceita lote", async () => {
  const service = api();
  const listed = await handleListGroupActivities(
    new Request("http://local/api/activity-groups/grp_david/activities?status=open&due=overdue&assignee=dpsilva&withinDays=2"),
    "grp_david",
    service,
    actor
  );
  assert.equal(listed.status, 200);
  const query = service.calls[0].args[1] as { status?: string; overdue?: boolean; assignee?: string; dueWithinDays?: number };
  assert.equal(query.status, "open");
  assert.equal(query.overdue, true);
  assert.equal(query.assignee, "dpsilva");
  assert.equal(query.dueWithinDays, 2);

  const added = await handleAddGroupActivities(
    new Request("http://local/api/activity-groups/grp_david/activities", {
      method: "POST",
      body: JSON.stringify({ activityIds: ["a", "b"] }),
    }),
    "grp_david",
    service,
    actor
  );
  assert.equal(added.status, 201);
  assert.deepEqual(service.calls[1].args[1], ["a", "b"]);
  assert.equal((await added.json()).activitiesDeleted, 0);

  const removed = await handleRemoveGroupActivities(
    new Request("http://local/api/activity-groups/grp_david/activities?activityIds=a,b"),
    "grp_david",
    service,
    actor
  );
  assert.equal(removed.status, 200);
  assert.deepEqual(service.calls[2].args[1], ["a", "b"]);
  assert.equal((await removed.json()).activitiesDeleted, 0);
});
