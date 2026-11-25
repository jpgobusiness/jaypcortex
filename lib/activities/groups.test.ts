import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_ACTIVITY_GROUPS,
  buildGroupActivityWhere,
  countGroupActivityStats,
  groupRemovalResult,
  membershipChangeResult,
  parseActivityIdList,
  parseGroupActivityQuery,
  parseGroupCreate,
  GroupError,
} from "./group-logic";

const today = new Date("2026-11-25T03:00:00.000Z");

test("grupos padrão: Nuage, Pessoal e Acompanhamento David", () => {
  assert.deepEqual(
    DEFAULT_ACTIVITY_GROUPS.map((group) => group.name),
    ["Nuage", "Pessoal", "Acompanhamento David"]
  );
  assert.equal(
    DEFAULT_ACTIVITY_GROUPS.find((group) => group.name === "Acompanhamento David")?.assigneeEmail,
    "dpsilva@nuageit.com.br"
  );
});

test("contagem: abertas e atrasadas ignoram concluídas", () => {
  const stats = countGroupActivityStats(
    [
      { status: "pending", dueDate: "2026-11-20T00:00:00.000Z" },
      { status: "pending", dueDate: "2026-11-26T00:00:00.000Z" },
      { status: "done", dueDate: "2026-11-01T00:00:00.000Z" },
    ],
    ["done"],
    today
  );
  assert.deepEqual(stats, { open: 2, overdue: 1 });
});

test("filtro do grupo: atrasadas, hoje e próximos dias", () => {
  const overdue = buildGroupActivityWhere({
    groupId: "grp_nuage",
    doneKeys: ["done"],
    todayStart: today,
    query: parseGroupActivityQuery({ overdue: "true", status: "done" }),
  });
  assert.deepEqual(overdue.dueDate, { lt: today });
  assert.deepEqual(overdue.status, { notIn: ["done"] });

  const within = buildGroupActivityWhere({
    groupId: "grp_nuage",
    doneKeys: ["done"],
    todayStart: today,
    query: parseGroupActivityQuery({ due_within_days: "3", status: "open" }),
  });
  assert.deepEqual(within.dueDate, {
    gte: today,
    lt: new Date(today.getTime() + 3 * 86_400_000),
  });
  assert.deepEqual(within.status, { notIn: ["done"] });
});

test("responsável: e-mail do grupo libera a lista; senão filtra aguardando", () => {
  const byGroup = buildGroupActivityWhere({
    groupId: "grp_david",
    doneKeys: ["done"],
    todayStart: today,
    query: parseGroupActivityQuery({ assignee: "dpsilva" }),
    groupAssignee: "dpsilva@nuageit.com.br",
  });
  assert.equal(byGroup.waitingOn, undefined);

  const byTask = buildGroupActivityWhere({
    groupId: "grp_nuage",
    doneKeys: ["done"],
    todayStart: today,
    query: parseGroupActivityQuery({ assignee: "maria" }),
    groupAssignee: "dpsilva@nuageit.com.br",
  });
  assert.deepEqual(byTask.waitingOn, { contains: "maria", mode: "insensitive" });
});

test("apagar grupo e tirar vínculo não apagam atividades", () => {
  assert.equal(groupRemovalResult({ archived: false, membershipsRemoved: 4 }).activitiesDeleted, 0);
  assert.equal(groupRemovalResult({ archived: true, membershipsRemoved: 4 }).activitiesDeleted, 0);
  assert.equal(groupRemovalResult({ archived: true, membershipsRemoved: 4 }).membershipsRemoved, 0);
  const added = membershipChangeResult("added", "grp_nuage", ["a", "b"], 2);
  assert.equal(added.activitiesDeleted, 0);
  assert.equal(added.added, 2);
});

test("lote de ids e e-mail do responsável", () => {
  assert.deepEqual(parseActivityIdList("a, b; c"), ["a", "b", "c"]);
  assert.deepEqual(parseActivityIdList('["a","b"]'), ["a", "b"]);
  const created = parseGroupCreate({
    name: " Acompanhamento David ",
    owner_email: "DPSILVA@nuageit.com.br",
  });
  assert.equal(created.name, "Acompanhamento David");
  assert.equal(created.assigneeEmail, "dpsilva@nuageit.com.br");
  assert.throws(() => parseGroupCreate({ name: "Nuage", assignee_email: "nao-e-email" }), GroupError);
});
