// Árvore de espaços no banco. As tools MCP e a API chamam isto.
import { prisma } from "@/lib/prisma";
import { upsertFileContent } from "@/lib/knowledge/files";
import { isDocumentKind } from "@/lib/knowledge/kinds";
import { writeAudit } from "@/lib/mcp/audit";
import { isHexColor, NAME_MAX_LENGTH, TITLE_MAX_LENGTH } from "@/lib/workspaces";
import { nextFileOrder, nextFolderOrder, nextWorkspaceOrder } from "@/lib/workspaces-db";
import {
  archiveBlockReason,
  chainDepth,
  documentPath,
  foldName,
  folderMoveBlockReason,
  introducesCycle,
  kindOf,
  MAX_TREE_DEPTH,
  nestTree,
  pickOne,
  splitPath,
  subtreeHeight,
  TreeError,
  type BulkFile,
  type BulkFolder,
  type BulkTree,
  type WorkspaceKind,
} from "@/lib/workspaces/tree-logic";

type Actor = { createdBy?: string | null; source?: string; tokenId?: string | null };

const workspaceSelect = {
  id: true,
  name: true,
  key: true,
  description: true,
  color: true,
  icon: true,
  kind: true,
  archivedAt: true,
  order: true,
} as const;

function actorSource(actor?: Actor) {
  return actor?.source === "mcp" ? "mcp" : "ui";
}

async function audit(actor: Actor | undefined, action: string, entity: string, entityId?: string | null) {
  if (actor?.source !== "mcp") return;
  await writeAudit({
    actorId: actor.createdBy,
    actorType: "mcp",
    tokenId: actor.tokenId,
    action,
    entity,
    entityId,
  });
}

export async function resolveWorkspace(token: string) {
  const key = token.trim();
  if (!key) throw new TreeError("Informe o espaço.", "not_found");
  const byId = await prisma.workspace.findUnique({ where: { id: key } });
  if (byId) {
    if (byId.archivedAt) throw new TreeError("Espaço arquivado.", "archived");
    return byId;
  }
  const rows = await prisma.workspace.findMany({ where: { archivedAt: null } });
  const hits = rows.filter((row) => foldName(row.name) === foldName(key) || row.key === key);
  return pickOne(hits, (row) => row.name, "Espaço");
}

async function folderParentMap(workspaceId: string) {
  const rows = await prisma.workspaceFolder.findMany({
    where: { workspaceId },
    select: { id: true, parentFolderId: true, name: true, opportunityId: true },
  });
  const parentOf = new Map(rows.map((row) => [row.id, row.parentFolderId]));
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentFolderId) continue;
    const list = children.get(row.parentFolderId) ?? [];
    list.push(row.id);
    children.set(row.parentFolderId, list);
  }
  return { rows, parentOf, childrenOf: (id: string) => children.get(id) ?? [] };
}

async function assertFolderDepth(workspaceId: string, folderId: string, nextParentId: string | null) {
  const map = await folderParentMap(workspaceId);
  if (introducesCycle(folderId, nextParentId, (id) => map.parentOf.get(id) ?? null)) {
    throw new TreeError("A pasta não pode entrar dentro de si.", "cycle");
  }
  const parentDepth = nextParentId ? chainDepth(nextParentId, (id) => map.parentOf.get(id) ?? null) : 0;
  const height = subtreeHeight(folderId, map.childrenOf);
  if (parentDepth + height > MAX_TREE_DEPTH) throw new TreeError(`A árvore passa de ${MAX_TREE_DEPTH} níveis.`, "too_deep");
}

export async function listWorkspaces(opts: { kind?: string | null; includeArchived?: boolean }) {
  const rows = await prisma.workspace.findMany({
    where: {
      ...(opts.includeArchived ? {} : { archivedAt: null }),
      ...(opts.kind ? { kind: opts.kind } : {}),
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      ...workspaceSelect,
      _count: { select: { folders: true, files: true } },
      agent: { select: { slug: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    key: row.key,
    kind: kindOf(row),
    description: row.description,
    color: row.color,
    icon: row.icon,
    archived: Boolean(row.archivedAt),
    folders: row._count.folders,
    files: row._count.files,
    agent: row.agent?.slug ?? null,
  }));
}

export async function createWorkspace(
  input: { name: string; description?: string; color?: string; icon?: string },
  actor?: Actor
) {
  const name = input.name.trim();
  if (!name) throw new TreeError("Informe o nome do espaço.", "invalid");
  if (name.length > NAME_MAX_LENGTH) throw new TreeError("Nome longo demais.", "invalid");
  if (input.color && !isHexColor(input.color)) throw new TreeError("Cor inválida. Use #RRGGBB.", "invalid");
  const existing = await prisma.workspace.findMany({ where: { archivedAt: null }, select: { name: true } });
  if (existing.some((row) => foldName(row.name) === foldName(name))) {
    throw new TreeError(`Já existe o espaço "${name}".`, "name_conflict");
  }
  const row = await prisma.workspace.create({
    data: {
      name,
      description: input.description?.trim() || null,
      color: input.color ?? "#7b68ee",
      icon: input.icon?.trim() || null,
      kind: "generic",
      order: await nextWorkspaceOrder(),
    },
    select: workspaceSelect,
  });
  await audit(actor, "create_workspace", "Workspace", row.id);
  return { ...row, kind: kindOf(row) as WorkspaceKind };
}

export async function updateWorkspace(
  token: string,
  patch: { name?: string; description?: string; color?: string; icon?: string },
  actor?: Actor
) {
  const current = await resolveWorkspace(token);
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new TreeError("Informe o nome do espaço.", "invalid");
    const existing = await prisma.workspace.findMany({
      where: { archivedAt: null, id: { not: current.id } },
      select: { name: true },
    });
    if (existing.some((row) => foldName(row.name) === foldName(name))) {
      throw new TreeError(`Já existe o espaço "${name}".`, "name_conflict");
    }
  }
  if (patch.color && !isHexColor(patch.color)) throw new TreeError("Cor inválida. Use #RRGGBB.", "invalid");
  const row = await prisma.workspace.update({
    where: { id: current.id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description.trim() || null } : {}),
      ...(patch.color ? { color: patch.color } : {}),
      ...(patch.icon !== undefined ? { icon: patch.icon.trim() || null } : {}),
    },
    select: workspaceSelect,
  });
  await audit(actor, "update_workspace", "Workspace", row.id);
  return row;
}

export async function archiveWorkspace(token: string, actor?: Actor) {
  const current = await resolveWorkspace(token);
  const block = archiveBlockReason(kindOf(current));
  if (block) throw new TreeError(block, "forbidden_move");
  await prisma.workspace.update({ where: { id: current.id }, data: { archivedAt: new Date() } });
  await audit(actor, "archive_workspace", "Workspace", current.id);
  return { archived: true, id: current.id, name: current.name };
}

export async function getWorkspaceTree(token: string) {
  const workspace = await resolveWorkspace(token);
  const [folders, files] = await Promise.all([
    prisma.workspaceFolder.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, parentFolderId: true, name: true, order: true },
    }),
    prisma.workspaceFile.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, folderId: true, parentFileId: true, title: true, order: true, kind: true },
    }),
  ]);
  const tree = nestTree(folders, files);
  return {
    id: workspace.id,
    name: workspace.name,
    kind: kindOf(workspace),
    description: workspace.description,
    color: workspace.color,
    icon: workspace.icon,
    ...tree,
    note: "Árvore sem o texto dos arquivos. Para ler um arquivo use read_document ou o path.",
  };
}

async function assertFolderName(workspaceId: string, parentFolderId: string | null, name: string, ignoreId?: string) {
  const siblings = await prisma.workspaceFolder.findMany({
    where: { workspaceId, parentFolderId, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
    select: { name: true },
  });
  if (siblings.some((row) => foldName(row.name) === foldName(name))) {
    throw new TreeError(`Já existe a pasta "${name}" neste nível.`, "name_conflict");
  }
}

export async function resolveFolder(ref: { id?: string; path?: string; workspace?: string }) {
  if (ref.id) {
    const folder = await prisma.workspaceFolder.findUnique({ where: { id: ref.id } });
    if (folder) return folder;
    if (!ref.path && !ref.workspace) throw new TreeError("Pasta não encontrada.", "not_found");
  }
  const parts = splitPath(ref.path || ref.id || "");
  const workspace = ref.workspace
    ? await resolveWorkspace(ref.workspace)
    : await resolveWorkspace(parts[0] || "");
  const names = ref.workspace ? parts : parts.slice(1);
  if (!names.length) throw new TreeError("Informe a pasta.", "not_found");
  let parentFolderId: string | null = null;
  let current: {
    id: string;
    workspaceId: string;
    parentFolderId: string | null;
    name: string;
    opportunityId: string | null;
  } | null = null;
  for (const name of names) {
    const siblings: {
      id: string;
      workspaceId: string;
      parentFolderId: string | null;
      name: string;
      opportunityId: string | null;
    }[] = await prisma.workspaceFolder.findMany({
      where: { workspaceId: workspace.id, parentFolderId },
    });
    const hits = siblings.filter((row) => foldName(row.name) === foldName(name));
    current = pickOne(hits, (row) => row.name, "Pasta");
    parentFolderId = current.id;
  }
  if (!current) throw new TreeError("Pasta não encontrada.", "not_found");
  return current;
}

export async function createFolder(
  input: { workspace: string; parent?: string; name: string },
  actor?: Actor
) {
  const name = input.name.trim();
  if (!name || name.length > NAME_MAX_LENGTH) throw new TreeError("Nome da pasta inválido.", "invalid");
  const workspace = await resolveWorkspace(input.workspace);
  const parent = input.parent
    ? await resolveFolder({ id: input.parent, path: input.parent, workspace: workspace.id })
    : null;
  if (parent && parent.workspaceId !== workspace.id) throw new TreeError("A pasta pai é de outro espaço.", "invalid");
  await assertFolderName(workspace.id, parent?.id ?? null, name);
  if (parent) await assertFolderDepth(workspace.id, "new", parent.id);
  const row = await prisma.workspaceFolder.create({
    data: {
      workspaceId: workspace.id,
      parentFolderId: parent?.id ?? null,
      name,
      order: await nextFolderOrder(workspace.id, parent?.id ?? null),
    },
  });
  await audit(actor, "create_folder", "WorkspaceFolder", row.id);
  return { id: row.id, name: row.name, workspace_id: workspace.id, parent_folder_id: row.parentFolderId };
}

export async function updateFolder(ref: { id?: string; path?: string }, name: string, actor?: Actor) {
  const folder = await resolveFolder(ref);
  const next = name.trim();
  if (!next) throw new TreeError("Informe o nome da pasta.", "invalid");
  await assertFolderName(folder.workspaceId, folder.parentFolderId, next, folder.id);
  const row = await prisma.workspaceFolder.update({ where: { id: folder.id }, data: { name: next } });
  await audit(actor, "update_folder", "WorkspaceFolder", row.id);
  return { id: row.id, name: row.name };
}

export async function moveFolder(
  ref: { id?: string; path?: string },
  target: { parent?: string | null; order?: number },
  actor?: Actor
) {
  const folder = await resolveFolder(ref);
  const block = folderMoveBlockReason(folder);
  if (block) throw new TreeError(block, "forbidden_move");
  const parent = target.parent ? await resolveFolder({ id: target.parent, workspace: folder.workspaceId }) : null;
  if (parent && parent.workspaceId !== folder.workspaceId) {
    throw new TreeError("A pasta só se move dentro do mesmo espaço.", "forbidden_move");
  }
  await assertFolderDepth(folder.workspaceId, folder.id, parent?.id ?? null);
  await assertFolderName(folder.workspaceId, parent?.id ?? null, folder.name, folder.id);
  const row = await prisma.workspaceFolder.update({
    where: { id: folder.id },
    data: {
      parentFolderId: parent?.id ?? null,
      ...(target.order !== undefined ? { order: target.order } : {}),
    },
  });
  await audit(actor, "move_folder", "WorkspaceFolder", row.id);
  return { id: row.id, parent_folder_id: row.parentFolderId, order: row.order };
}

export async function deleteFolder(ref: { id?: string; path?: string }, actor?: Actor) {
  const folder = await resolveFolder(ref);
  const block = folderMoveBlockReason(folder);
  if (block) throw new TreeError(block, "forbidden_move");
  await prisma.workspaceFolder.delete({ where: { id: folder.id } });
  await audit(actor, "delete_folder", "WorkspaceFolder", folder.id);
  return { deleted: true, id: folder.id, name: folder.name };
}

async function fileParentMap(workspaceId: string) {
  const rows = await prisma.workspaceFile.findMany({
    where: { workspaceId },
    select: { id: true, parentFileId: true, folderId: true, title: true },
  });
  const parentOf = new Map(rows.map((row) => [row.id, row.parentFileId]));
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentFileId) continue;
    const list = children.get(row.parentFileId) ?? [];
    list.push(row.id);
    children.set(row.parentFileId, list);
  }
  return { rows, parentOf, childrenOf: (id: string) => children.get(id) ?? [] };
}

export async function resolveFile(ref: { id?: string; path?: string; workspace?: string }) {
  if (ref.id) {
    const file = await prisma.workspaceFile.findUnique({ where: { id: ref.id } });
    if (!file) throw new TreeError("Arquivo não encontrado.", "not_found");
    return file;
  }
  const parts = splitPath(ref.path || "");
  if (!parts.length) throw new TreeError("Informe o arquivo.", "not_found");
  const workspace = ref.workspace
    ? await resolveWorkspace(ref.workspace)
    : parts.length > 1
      ? await resolveWorkspace(parts[0])
      : null;
  if (!workspace) {
    const files = await prisma.workspaceFile.findMany({ where: { title: { equals: parts[0], mode: "insensitive" } }, take: 8 });
    return pickOne(files, (row) => row.title, "Arquivo");
  }
  const title = parts[parts.length - 1];
  const folderParts = ref.workspace ? parts.slice(0, -1) : parts.slice(1, -1);
  const folder = folderParts.length
    ? await resolveFolder({ path: folderParts.join("/"), workspace: workspace.id })
    : null;
  const files = await prisma.workspaceFile.findMany({
    where: { workspaceId: workspace.id, folderId: folder?.id ?? null },
  });
  const hits = files.filter((row) => foldName(row.title) === foldName(title));
  return pickOne(hits, (row) => row.title, "Arquivo");
}

async function assertFileTitle(opts: {
  workspaceId: string;
  folderId: string | null;
  parentFileId: string | null;
  title: string;
  ignoreId?: string;
}) {
  const siblings = await prisma.workspaceFile.findMany({
    where: {
      workspaceId: opts.workspaceId,
      folderId: opts.folderId,
      parentFileId: opts.parentFileId,
      ...(opts.ignoreId ? { id: { not: opts.ignoreId } } : {}),
    },
    select: { title: true },
  });
  if (siblings.some((row) => foldName(row.title) === foldName(opts.title))) {
    throw new TreeError(`Já existe o arquivo "${opts.title}" neste nível.`, "name_conflict");
  }
}

export async function createFile(
  input: { workspace: string; folder?: string; parentFile?: string; title: string; markdown?: string; kind?: string },
  actor?: Actor
) {
  const title = input.title.trim();
  if (!title || title.length > TITLE_MAX_LENGTH) throw new TreeError("Título inválido.", "invalid");
  const workspace = await resolveWorkspace(input.workspace);
  const folder = input.folder
    ? await resolveFolder({ id: input.folder, path: input.folder, workspace: workspace.id })
    : null;
  if (folder && folder.workspaceId !== workspace.id) throw new TreeError("A pasta é de outro espaço.", "invalid");
  const parent = input.parentFile ? await resolveFile({ id: input.parentFile }) : null;
  if (parent && parent.workspaceId !== workspace.id) throw new TreeError("O arquivo pai é de outro espaço.", "invalid");
  const folderId = parent?.folderId ?? folder?.id ?? null;
  if (parent && folder && parent.folderId !== folder.id) {
    throw new TreeError("O subarquivo fica na pasta do arquivo pai.", "invalid");
  }
  await assertFileTitle({ workspaceId: workspace.id, folderId, parentFileId: parent?.id ?? null, title });
  if (parent) {
    const map = await fileParentMap(workspace.id);
    const depth = chainDepth(parent.id, (id) => map.parentOf.get(id) ?? null) + 1;
    if (depth > MAX_TREE_DEPTH) throw new TreeError(`A árvore passa de ${MAX_TREE_DEPTH} níveis.`, "too_deep");
  }
  const saved = await upsertFileContent({
    workspaceId: workspace.id,
    folderId,
    parentFileId: parent?.id ?? null,
    title,
    content: input.markdown ?? "",
    kind: input.kind && isDocumentKind(input.kind) ? input.kind : "contexto",
    createdBy: actor?.createdBy ?? null,
    source: actorSource(actor),
  });
  await audit(actor, "create_file", "WorkspaceFile", saved.file?.id);
  return {
    id: saved.file?.id,
    title,
    workspace_id: workspace.id,
    folder_id: folderId,
    parent_file_id: parent?.id ?? null,
    path: documentPath({
      workspaceName: workspace.name,
      folderId,
      fileId: saved.file?.id || "",
      folders: folder ? [{ id: folder.id, parentFolderId: folder.parentFolderId, name: folder.name }] : [],
      files: [{ id: saved.file?.id || "", parentFileId: parent?.id ?? null, title }],
    }),
  };
}

async function retargetFolder(fileId: string, folderId: string | null) {
  await prisma.workspaceFile.update({ where: { id: fileId }, data: { folderId } });
  const children = await prisma.workspaceFile.findMany({ where: { parentFileId: fileId }, select: { id: true } });
  for (const child of children) await retargetFolder(child.id, folderId);
}

export async function moveFile(
  ref: { id?: string; path?: string },
  target: { folder?: string | null; parentFile?: string | null; order?: number },
  actor?: Actor
) {
  const file = await resolveFile(ref);
  const folder = target.folder ? await resolveFolder({ id: target.folder, workspace: file.workspaceId }) : null;
  if (folder && folder.workspaceId !== file.workspaceId) throw new TreeError("A pasta é de outro espaço.", "forbidden_move");
  const parent = target.parentFile ? await resolveFile({ id: target.parentFile }) : null;
  if (parent && parent.workspaceId !== file.workspaceId) throw new TreeError("O arquivo pai é de outro espaço.", "forbidden_move");
  const map = await fileParentMap(file.workspaceId);
  const nextParent = parent?.id ?? null;
  if (introducesCycle(file.id, nextParent, (id) => map.parentOf.get(id) ?? null)) {
    throw new TreeError("O arquivo não pode entrar dentro de si.", "cycle");
  }
  const folderId = parent ? parent.folderId : target.folder === undefined ? file.folderId : folder?.id ?? null;
  await assertFileTitle({
    workspaceId: file.workspaceId,
    folderId,
    parentFileId: nextParent,
    title: file.title,
    ignoreId: file.id,
  });
  await prisma.workspaceFile.update({
    where: { id: file.id },
    data: {
      parentFileId: nextParent,
      folderId,
      ...(target.order !== undefined ? { order: target.order } : { order: await nextFileOrder(file.workspaceId, folderId, nextParent) }),
    },
  });
  await retargetFolder(file.id, folderId);
  await audit(actor, "move_file", "WorkspaceFile", file.id);
  return { id: file.id, folder_id: folderId, parent_file_id: nextParent };
}

export async function updateFile(
  ref: { id?: string; path?: string },
  patch: { title?: string; markdown?: string },
  actor?: Actor
) {
  const file = await resolveFile(ref);
  if (patch.markdown === undefined) {
    const title = patch.title?.trim() || file.title;
    if (patch.title) {
      await assertFileTitle({
        workspaceId: file.workspaceId,
        folderId: file.folderId,
        parentFileId: file.parentFileId,
        title,
        ignoreId: file.id,
      });
    }
    await prisma.workspaceFile.update({ where: { id: file.id }, data: { title } });
    await audit(actor, "update_file", "WorkspaceFile", file.id);
    return { id: file.id, title };
  }
  if (patch.title) {
    await assertFileTitle({
      workspaceId: file.workspaceId,
      folderId: file.folderId,
      parentFileId: file.parentFileId,
      title: patch.title.trim(),
      ignoreId: file.id,
    });
  }
  const saved = await upsertFileContent({
    fileId: file.id,
    title: patch.title?.trim() || file.title,
    content: patch.markdown,
    createdBy: actor?.createdBy ?? null,
    source: actorSource(actor),
  });
  await audit(actor, "update_file", "WorkspaceFile", file.id);
  return { id: file.id, title: saved.file?.title ?? file.title, hash: saved.hash };
}

export async function deleteFile(ref: { id?: string; path?: string }, actor?: Actor) {
  const file = await resolveFile(ref);
  await prisma.workspaceFile.delete({ where: { id: file.id } });
  await audit(actor, "delete_file", "WorkspaceFile", file.id);
  return { deleted: true, id: file.id, title: file.title };
}

export async function listFiles(opts: { workspace?: string; folder?: string; parentFile?: string }) {
  const workspace = opts.workspace ? await resolveWorkspace(opts.workspace) : null;
  const folder = opts.folder ? await resolveFolder({ id: opts.folder, path: opts.folder, workspace: workspace?.id }) : null;
  const parent = opts.parentFile ? await resolveFile({ id: opts.parentFile }) : null;
  const rows = await prisma.workspaceFile.findMany({
    where: {
      ...(workspace ? { workspaceId: workspace.id } : {}),
      ...(folder ? { folderId: folder.id } : {}),
      parentFileId: parent?.id ?? null,
    },
    orderBy: [{ order: "asc" }, { title: "asc" }],
    select: { id: true, title: true, kind: true, folderId: true, parentFileId: true, order: true },
    take: 80,
  });
  return rows;
}

export async function getFileChildren(token: string) {
  const file = await resolveFile({ id: token.includes("/") ? undefined : token, path: token.includes("/") ? token : undefined });
  const children = await prisma.workspaceFile.findMany({
    where: { parentFileId: file.id },
    orderBy: [{ order: "asc" }, { title: "asc" }],
    select: { id: true, title: true, kind: true, order: true },
  });
  return { id: file.id, title: file.title, children };
}

async function ensureFolder(workspaceId: string, parentFolderId: string | null, name: string, actor?: Actor) {
  const siblings = await prisma.workspaceFolder.findMany({ where: { workspaceId, parentFolderId } });
  const found = siblings.find((row) => foldName(row.name) === foldName(name));
  if (found) return { row: found, created: false };
  const row = await prisma.workspaceFolder.create({
    data: { workspaceId, parentFolderId, name, order: await nextFolderOrder(workspaceId, parentFolderId) },
  });
  await audit(actor, "create_folder", "WorkspaceFolder", row.id);
  return { row, created: true };
}

async function ensureFile(
  workspaceId: string,
  folderId: string | null,
  parentFileId: string | null,
  file: BulkFile,
  actor?: Actor
) {
  const siblings = await prisma.workspaceFile.findMany({
    where: { workspaceId, folderId, parentFileId },
    select: { id: true, title: true },
  });
  const found = siblings.find((row) => foldName(row.title) === foldName(file.title));
  let id = found?.id;
  let created = false;
  if (!id) {
    const saved = await upsertFileContent({
      workspaceId,
      folderId,
      parentFileId,
      title: file.title,
      content: file.markdown ?? "",
      kind: file.kind && isDocumentKind(file.kind) ? file.kind : "contexto",
      createdBy: actor?.createdBy ?? null,
      source: actorSource(actor),
    });
    id = saved.file?.id;
    created = true;
  }
  let childCreated = 0;
  let childExisting = 0;
  for (const child of file.children ?? []) {
    const result = await ensureFile(workspaceId, folderId, id ?? null, child, actor);
    childCreated += result.created;
    childExisting += result.existing;
  }
  return { created: (created ? 1 : 0) + childCreated, existing: (created ? 0 : 1) + childExisting };
}

async function ensureFolderTree(workspaceId: string, parentFolderId: string | null, folder: BulkFolder, actor?: Actor) {
  const current = await ensureFolder(workspaceId, parentFolderId, folder.name, actor);
  let created = current.created ? 1 : 0;
  let existing = current.created ? 0 : 1;
  for (const child of folder.folders ?? []) {
    const result = await ensureFolderTree(workspaceId, current.row.id, child, actor);
    created += result.created;
    existing += result.existing;
  }
  let filesCreated = 0;
  let filesExisting = 0;
  for (const file of folder.files ?? []) {
    const result = await ensureFile(workspaceId, current.row.id, null, file, actor);
    filesCreated += result.created;
    filesExisting += result.existing;
  }
  return { created: created + filesCreated, existing: existing + filesExisting };
}

export async function createStructureBulk(tree: BulkTree, actor?: Actor) {
  let workspace;
  let workspaceCreated = false;
  try {
    workspace = await resolveWorkspace(tree.workspace);
  } catch (error) {
    if (!(error instanceof TreeError) || error.code !== "not_found") throw error;
    workspace = await prisma.workspace.create({
      data: {
        name: tree.workspace,
        description: tree.description?.trim() || null,
        color: tree.color && isHexColor(tree.color) ? tree.color : "#7b68ee",
        icon: tree.icon?.trim() || null,
        kind: "generic",
        order: await nextWorkspaceOrder(),
      },
    });
    workspaceCreated = true;
    await audit(actor, "create_workspace", "Workspace", workspace.id);
  }
  let created = 0;
  let existing = 0;
  for (const folder of tree.folders ?? []) {
    const result = await ensureFolderTree(workspace.id, null, folder, actor);
    created += result.created;
    existing += result.existing;
  }
  for (const file of tree.files ?? []) {
    const result = await ensureFile(workspace.id, null, null, file, actor);
    created += result.created;
    existing += result.existing;
  }
  return {
    workspace_id: workspace.id,
    workspace: workspace.name,
    workspace_created: workspaceCreated,
    created,
    existing,
    note: "Rodar de novo não duplica pasta nem arquivo com o mesmo nome no mesmo nível.",
  };
}

export async function linkKnowledgeTree(agentToken: string, target: string) {
  const agent = await prisma.agent.findFirst({
    where: { OR: [{ id: agentToken }, { slug: agentToken }, { name: { equals: agentToken, mode: "insensitive" } }] },
    select: { id: true, name: true },
  });
  if (!agent) throw new TreeError("Agente não encontrado.", "not_found");
  let workspaceId: string;
  let folderIds: string[] | null = null;
  try {
    const folder = await resolveFolder({ id: target.includes("/") ? undefined : target, path: target.includes("/") ? target : undefined });
    workspaceId = folder.workspaceId;
    const map = await folderParentMap(workspaceId);
    const ids = [folder.id];
    const walk = (id: string) => {
      for (const child of map.childrenOf(id)) {
        ids.push(child);
        walk(child);
      }
    };
    walk(folder.id);
    folderIds = ids;
  } catch (error) {
    if (!(error instanceof TreeError) || error.code !== "not_found") throw error;
    const workspace = await resolveWorkspace(target);
    workspaceId = workspace.id;
  }
  const files = await prisma.workspaceFile.findMany({
    where: { workspaceId, ...(folderIds ? { folderId: { in: folderIds } } : {}) },
    select: { id: true },
  });
  for (const file of files) {
    await prisma.agentKnowledge.upsert({
      where: { agentId_fileId: { agentId: agent.id, fileId: file.id } },
      create: { agentId: agent.id, fileId: file.id },
      update: {},
    });
  }
  return { agent: agent.name, linked: files.length };
}

export { TreeError, documentPath };
