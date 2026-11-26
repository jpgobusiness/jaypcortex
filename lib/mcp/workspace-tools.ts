import { z } from "zod";
import { parseBulkTree, TreeError } from "@/lib/workspaces/tree-logic";
import { readMeta, writeMeta, type ToolServer } from "@/lib/mcp/annotations";
import { asBool } from "@/lib/mcp/quick-compat";

const str = z.string().optional();

export const createWorkspaceSchema = z.object({
  name: z.string(),
  description: str,
  color: str,
  icon: str,
});
export const updateWorkspaceSchema = z.object({
  workspace: z.string(),
  name: str,
  description: str,
  color: str,
  icon: str,
});
export const archiveWorkspaceSchema = z.object({ workspace: z.string(), confirm: str });
export const listWorkspacesSchema = z.object({ kind: str, include_archived: str });
export const workspaceSchema = z.object({ workspace: z.string() });
export const createFolderSchema = z.object({ workspace: z.string(), parent: str, name: z.string() });
export const updateFolderSchema = z.object({ folder: z.string(), name: z.string() });
export const moveFolderSchema = z.object({ folder: z.string(), parent: str, order: str });
export const deleteFolderSchema = z.object({ folder: z.string(), confirm: str });
export const createFileSchema = z.object({
  workspace: z.string(),
  folder: str,
  parent_file: str,
  title: z.string(),
  markdown: str,
  kind: str,
});
export const updateFileSchema = z.object({ file: z.string(), title: str, markdown: str });
export const moveFileSchema = z.object({ file: z.string(), folder: str, parent_file: str, order: str });
export const deleteFileSchema = z.object({ file: z.string(), confirm: str });
export const listFilesSchema = z.object({ workspace: str, folder: str, parent_file: str });
export const fileSchema = z.object({ file: z.string() });
export const bulkSchema = z.object({ tree: z.string(), mode: str });
export const linkTreeSchema = z.object({ agent: z.string(), target: z.string() });

export type WorkspaceToolApi = {
  list(opts: { kind?: string; includeArchived?: boolean }): Promise<unknown>;
  createWorkspace(input: { name: string; description?: string; color?: string; icon?: string }): Promise<unknown>;
  updateWorkspace(token: string, patch: { name?: string; description?: string; color?: string; icon?: string }): Promise<unknown>;
  archive(token: string): Promise<unknown>;
  tree(token: string): Promise<unknown>;
  createFolder(input: { workspace: string; parent?: string; name: string }): Promise<unknown>;
  updateFolder(token: string, name: string): Promise<unknown>;
  moveFolder(token: string, target: { parent?: string | null; order?: number }): Promise<unknown>;
  deleteFolder(token: string): Promise<unknown>;
  createFile(input: { workspace: string; folder?: string; parentFile?: string; title: string; markdown?: string; kind?: string }): Promise<unknown>;
  updateFile(token: string, patch: { title?: string; markdown?: string }): Promise<unknown>;
  moveFile(token: string, target: { folder?: string | null; parentFile?: string | null; order?: number }): Promise<unknown>;
  deleteFile(token: string): Promise<unknown>;
  listFiles(opts: { workspace?: string; folder?: string; parentFile?: string }): Promise<unknown>;
  children(token: string): Promise<unknown>;
  bulk(tree: string): Promise<unknown>;
  link(agent: string, target: string): Promise<unknown>;
};

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function allows(scopes: string[], needed: "read" | "write") {
  return scopes.includes("admin") || scopes.includes(needed);
}

function clean(value: unknown) {
  const next = String(value ?? "").trim();
  return next || undefined;
}

function required(value: unknown, label: string) {
  const next = clean(value);
  if (!next) throw new TreeError(`Informe ${label}.`, "invalid");
  return next;
}

async function run(fn: () => Promise<unknown>) {
  try {
    return text(await fn());
  } catch (error) {
    if (error instanceof TreeError) return text({ error: error.code, message: error.message, candidates: error.candidates });
    if (error instanceof Error) return text({ error: "invalid", message: error.message });
    throw error;
  }
}

export function bindWorkspaceTools(
  server: ToolServer,
  ctx: { scopes: string[] },
  api: WorkspaceToolApi
) {
  const gate = (needed: "read" | "write", fn: () => Promise<unknown>) => {
    if (!allows(ctx.scopes, needed)) return text({ error: "forbidden", message: "Token sem permissão para esta tool" });
    return run(fn);
  };

  server.registerTool("list_workspaces", {
    ...readMeta("Listar espaços"),
    description: "Lista espaços de trabalho. kind: generic, agent_room ou opportunities. include_archived=true mostra os arquivados. Sala de agente e Oportunidades aparecem com o kind certo.",
    inputSchema: listWorkspacesSchema,
  }, async (args) => gate("read", () => api.list({
    kind: clean(args.kind),
    includeArchived: asBool(args.include_archived),
  })));

  server.registerTool("get_workspace_tree", {
    ...readMeta("Árvore do espaço"),
    description: "Árvore de um espaço: pastas, subpastas, arquivos e subarquivos, sem o texto. workspace é o id, o nome ou o caminho. Para ler o conteúdo use read_document.",
    inputSchema: workspaceSchema,
  }, async (args) => gate("read", () => api.tree(required(args.workspace, "o espaço"))));

  server.registerTool("create_workspace", {
    ...writeMeta("Criar espaço"),
    description: "Cria um espaço genérico, sem agente. name é o nome (ex.: Visão de Negócios). color em #RRGGBB. Não cria sala de agente: isso continua em create_agent.",
    inputSchema: createWorkspaceSchema,
  }, async (args) => gate("write", () => api.createWorkspace({
    name: required(args.name, "o nome"),
    description: clean(args.description),
    color: clean(args.color),
    icon: clean(args.icon),
  })));

  server.registerTool("update_workspace", {
    ...writeMeta("Renomear espaço", { idempotent: true }),
    description: "Renomeia ou atualiza descrição, cor e ícone de um espaço. workspace é id ou nome.",
    inputSchema: updateWorkspaceSchema,
  }, async (args) => gate("write", () => api.updateWorkspace(required(args.workspace, "o espaço"), {
    name: clean(args.name),
    description: args.description === undefined ? undefined : String(args.description),
    color: clean(args.color),
    icon: args.icon === undefined ? undefined : String(args.icon),
  })));

  server.registerTool("archive_workspace", {
    ...writeMeta("Arquivar espaço", { destructive: true, idempotent: true }),
    description: "Arquiva um espaço genérico. Exige confirm=true. Não apaga arquivos. Recusa a sala de um agente e o espaço Oportunidades.",
    inputSchema: archiveWorkspaceSchema,
  }, async (args) => gate("write", async () => {
    if (!asBool(args.confirm)) throw new TreeError("Para arquivar, envie confirm=true.", "confirm_required");
    return api.archive(required(args.workspace, "o espaço"));
  }));

  server.registerTool("create_folder", {
    ...writeMeta("Criar pasta"),
    description: "Cria pasta num espaço. parent é a pasta pai (id ou caminho) para subpasta. Sem parent, fica na raiz. Nome único entre irmãs.",
    inputSchema: createFolderSchema,
  }, async (args) => gate("write", () => api.createFolder({
    workspace: required(args.workspace, "o espaço"),
    parent: clean(args.parent),
    name: required(args.name, "o nome"),
  })));

  server.registerTool("update_folder", {
    ...writeMeta("Renomear pasta", { idempotent: true }),
    description: "Renomeia uma pasta. folder é o id ou o caminho (Visão de Negócios/01 - Finanças).",
    inputSchema: updateFolderSchema,
  }, async (args) => gate("write", () => api.updateFolder(required(args.folder, "a pasta"), required(args.name, "o nome"))));

  server.registerTool("move_folder", {
    ...writeMeta("Mover pasta", { idempotent: true }),
    description: "Move uma pasta para outro pai no mesmo espaço. parent vazio joga para a raiz. Recusa ciclo, pasta de oportunidade e _Templates.",
    inputSchema: moveFolderSchema,
  }, async (args) => gate("write", () => api.moveFolder(required(args.folder, "a pasta"), {
    parent: args.parent === undefined ? undefined : clean(args.parent) ?? null,
    order: clean(args.order) ? Number(args.order) : undefined,
  })));

  server.registerTool("delete_folder", {
    ...writeMeta("Apagar pasta", { destructive: true }),
    description: "Apaga a pasta e o que está dentro (subpastas e arquivos). Exige confirm=true. Não apaga pasta de oportunidade nem _Templates.",
    inputSchema: deleteFolderSchema,
  }, async (args) => gate("write", async () => {
    if (!asBool(args.confirm)) throw new TreeError("Para apagar a pasta, envie confirm=true.", "confirm_required");
    return api.deleteFolder(required(args.folder, "a pasta"));
  }));

  server.registerTool("create_file", {
    ...writeMeta("Criar arquivo"),
    description: "Cria um arquivo em qualquer espaço. folder e parent_file são opcionais. parent_file cria subarquivo (página dentro da página). markdown é o texto inicial. Grava direto, sem proposta.",
    inputSchema: createFileSchema,
  }, async (args) => gate("write", () => api.createFile({
    workspace: required(args.workspace, "o espaço"),
    folder: clean(args.folder),
    parentFile: clean(args.parent_file),
    title: required(args.title, "o título"),
    markdown: args.markdown === undefined ? undefined : String(args.markdown),
    kind: clean(args.kind),
  })));

  server.registerTool("update_file", {
    ...writeMeta("Editar arquivo", { idempotent: true }),
    description: "Atualiza título e/ou markdown de um arquivo. file é id ou caminho. Grava revisão. Para mudar uma seção de proposta, use upsert_section.",
    inputSchema: updateFileSchema,
  }, async (args) => gate("write", () => api.updateFile(required(args.file, "o arquivo"), {
    title: clean(args.title),
    markdown: args.markdown === undefined ? undefined : String(args.markdown),
  })));

  server.registerTool("move_file", {
    ...writeMeta("Mover arquivo", { idempotent: true }),
    description: "Move arquivo de pasta ou para dentro de outro arquivo (parent_file). Os subarquivos vão junto. Recusa ciclo.",
    inputSchema: moveFileSchema,
  }, async (args) => gate("write", () => api.moveFile(required(args.file, "o arquivo"), {
    folder: args.folder === undefined ? undefined : clean(args.folder) ?? null,
    parentFile: args.parent_file === undefined ? undefined : clean(args.parent_file) ?? null,
    order: clean(args.order) ? Number(args.order) : undefined,
  })));

  server.registerTool("delete_file", {
    ...writeMeta("Apagar arquivo", { destructive: true }),
    description: "Apaga o arquivo e os subarquivos. Exige confirm=true.",
    inputSchema: deleteFileSchema,
  }, async (args) => gate("write", async () => {
    if (!asBool(args.confirm)) throw new TreeError("Para apagar o arquivo, envie confirm=true.", "confirm_required");
    return api.deleteFile(required(args.file, "o arquivo"));
  }));

  server.registerTool("list_files", {
    ...readMeta("Listar arquivos"),
    description: "Lista arquivos de um nível. workspace, folder e parent_file são opcionais. Sem parent_file, lista só os que não são subarquivo.",
    inputSchema: listFilesSchema,
  }, async (args) => gate("read", () => api.listFiles({
    workspace: clean(args.workspace),
    folder: clean(args.folder),
    parentFile: clean(args.parent_file),
  })));

  server.registerTool("get_file_children", {
    ...readMeta("Subarquivos"),
    description: "Lista os subarquivos diretos de um arquivo. file é id ou caminho.",
    inputSchema: fileSchema,
  }, async (args) => gate("read", () => api.children(required(args.file, "o arquivo"))));

  server.registerTool("create_structure_bulk", {
    ...writeMeta("Montar estrutura", { idempotent: true }),
    description: "Cria espaço, pastas, subpastas, arquivos e subarquivos de uma vez. tree é um JSON em texto: {workspace, folders:[{name, files:[{title, children:[{title}]}]}]}. Idempotente pelo nome. Repetir não duplica.",
    inputSchema: bulkSchema,
  }, async (args) => gate("write", async () => {
    parseBulkTree(required(args.tree, "a árvore"));
    return api.bulk(required(args.tree, "a árvore"));
  }));

  server.registerTool("link_knowledge_tree", {
    ...writeMeta("Vincular árvore à base", { idempotent: true }),
    description: "Vincula todos os arquivos de um espaço ou de uma pasta (e subpastas) à base de um agente. agent é slug ou nome. target é o espaço ou o caminho da pasta.",
    inputSchema: linkTreeSchema,
  }, async (args) => gate("write", () => api.link(required(args.agent, "o agente"), required(args.target, "o alvo"))));
}
