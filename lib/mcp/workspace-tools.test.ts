import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { jsonSchemaTypeIssues } from "./activity-schemas";
import type { ToolServer } from "./annotations";
import { bindWorkspaceTools, type WorkspaceToolApi } from "./workspace-tools";

function harness(scopes: string[]) {
  const tools = new Map<string, { description: string; schema: z.ZodType; handler: (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }> }>();
  const calls: string[] = [];
  const api: WorkspaceToolApi = {
    list: async () => [],
    createWorkspace: async (input) => {
      calls.push("create_workspace");
      return input;
    },
    updateWorkspace: async () => ({}),
    archive: async () => {
      calls.push("archive");
      return { archived: true };
    },
    tree: async () => ({ folders: [] }),
    createFolder: async () => {
      calls.push("create_folder");
      return { id: "f1" };
    },
    updateFolder: async () => ({}),
    moveFolder: async () => ({}),
    deleteFolder: async () => {
      calls.push("delete_folder");
      return { deleted: true };
    },
    createFile: async () => {
      calls.push("create_file");
      return { id: "a1" };
    },
    updateFile: async () => ({}),
    moveFile: async () => ({}),
    deleteFile: async () => {
      calls.push("delete_file");
      return { deleted: true };
    },
    listFiles: async () => [],
    children: async () => [],
    bulk: async () => {
      calls.push("bulk");
      return { created: 1 };
    },
    link: async () => ({ linked: 0 }),
  };
  const server: ToolServer = {
    registerTool(name, config, handler) {
      tools.set(name, { description: config.description, schema: config.inputSchema as z.ZodType, handler });
    },
  };
  bindWorkspaceTools(server, { scopes }, api);
  return { tools, calls };
}

function payload(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

test("tools de espaço são string, curtas e em português", () => {
  const { tools } = harness(["read", "write"]);
  assert.ok(tools.has("list_workspaces"));
  assert.ok(tools.has("create_structure_bulk"));
  assert.ok(tools.has("create_file"));
  for (const [name, tool] of tools) {
    assert.match(tool.description, /[áàâãéêíóôõúç]|espaço|pasta|arquivo/i, name);
    const schema = z.toJSONSchema(tool.schema) as { properties?: Record<string, { type?: unknown }> };
    assert.deepEqual(jsonSchemaTypeIssues(schema), [], name);
    const fields = Object.entries(schema.properties || {});
    assert.ok(fields.length <= 8, `${name} tem ${fields.length} campos`);
    for (const [field, spec] of fields) assert.equal(spec.type, "string", `${name}.${field}`);
  }
  assert.match(tools.get("archive_workspace")!.description, /confirm=true/);
  assert.match(tools.get("delete_folder")!.description, /confirm=true/);
  assert.match(tools.get("delete_file")!.description, /confirm=true/);
});

test("apagar e arquivar exigem confirm e leitura não grava", async () => {
  const denied = harness(["read"]);
  const blocked = payload(await denied.tools.get("create_workspace")!.handler({ name: "Visão de Negócios" }));
  assert.match(String(blocked.error), /forbidden|permissão/);
  assert.equal(denied.calls.length, 0);

  const { tools, calls } = harness(["write"]);
  const noConfirm = payload(await tools.get("delete_file")!.handler({ file: "a1" }));
  assert.equal(noConfirm.error, "confirm_required");
  const archived = payload(await tools.get("archive_workspace")!.handler({ workspace: "Sala", confirm: "false" }));
  assert.equal(archived.error, "confirm_required");
  assert.equal(calls.includes("delete_file"), false);
  assert.equal(calls.includes("archive"), false);

  const removed = payload(await tools.get("delete_folder")!.handler({ folder: "f1", confirm: "true" }));
  assert.equal(removed.deleted, true);
  assert.equal(calls.includes("delete_folder"), true);
});

test("estrutura em lote recusa JSON inválido antes de gravar", async () => {
  const { tools, calls } = harness(["write"]);
  const bad = payload(await tools.get("create_structure_bulk")!.handler({ tree: "{" }));
  assert.equal(bad.error, "invalid");
  assert.equal(calls.includes("bulk"), false);
  const ok = payload(await tools.get("create_structure_bulk")!.handler({
    tree: JSON.stringify({ workspace: "Visão de Negócios", folders: [{ name: "00 Finanças" }] }),
  }));
  assert.equal(ok.created, 1);
});
