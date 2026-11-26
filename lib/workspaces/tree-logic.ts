// Regras da árvore de espaços, sem banco. O serviço e os testes importam daqui.

export const WORKSPACE_KINDS = ["generic", "agent_room", "opportunities"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];
export const MAX_TREE_DEPTH = 8;
export const TEMPLATES_FOLDER_NAME = "_Templates";

export type TreeCode =
  | "not_found"
  | "ambiguous"
  | "name_conflict"
  | "cycle"
  | "too_deep"
  | "forbidden_move"
  | "confirm_required"
  | "archived"
  | "invalid";

export class TreeError extends Error {
  constructor(
    message: string,
    public code: TreeCode,
    public candidates?: { id: string; label: string }[]
  ) {
    super(message);
  }
}

export function foldName(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function isWorkspaceKind(value: string): value is WorkspaceKind {
  return (WORKSPACE_KINDS as readonly string[]).includes(value);
}

export function kindOf(row: { key?: string | null; hasAgent?: boolean; kind?: string | null }): WorkspaceKind {
  if (row.kind && isWorkspaceKind(row.kind)) return row.kind;
  if (row.hasAgent) return "agent_room";
  if (row.key === "opportunities") return "opportunities";
  return "generic";
}

export function archiveBlockReason(kind: string) {
  if (kind === "agent_room") return "A sala do agente não se arquiva por aqui.";
  if (kind === "opportunities") return "O espaço Oportunidades não se arquiva.";
  return null;
}

export function splitPath(value: string) {
  return value
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function introducesCycle(
  movingId: string,
  nextParentId: string | null,
  parentOf: (id: string) => string | null | undefined
) {
  if (!nextParentId) return false;
  if (nextParentId === movingId) return true;
  const seen = new Set<string>();
  let cursor: string | null | undefined = nextParentId;
  while (cursor) {
    if (cursor === movingId || seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = parentOf(cursor);
  }
  return false;
}

export function chainDepth(id: string, parentOf: (id: string) => string | null | undefined) {
  let depth = 1;
  const seen = new Set<string>([id]);
  let cursor = parentOf(id);
  while (cursor) {
    if (seen.has(cursor)) break;
    seen.add(cursor);
    depth += 1;
    cursor = parentOf(cursor);
  }
  return depth;
}

export function subtreeHeight(id: string, childrenOf: (id: string) => string[]) {
  const seen = new Set<string>();
  function height(current: string): number {
    if (seen.has(current)) return 1;
    seen.add(current);
    const children = childrenOf(current);
    if (children.length === 0) return 1;
    return 1 + Math.max(...children.map(height));
  }
  return height(id);
}

export function assertDepth(depth: number) {
  if (depth > MAX_TREE_DEPTH) {
    throw new TreeError(`A árvore passa de ${MAX_TREE_DEPTH} níveis.`, "too_deep");
  }
}

export function pickOne<T extends { id: string }>(
  rows: T[],
  labelOf: (row: T) => string,
  what: string
): T {
  if (rows.length === 0) throw new TreeError(`${what} não encontrado.`, "not_found");
  if (rows.length === 1) return rows[0];
  throw new TreeError(
    `Há mais de um ${what.toLowerCase()}. Escolha pelo id.`,
    "ambiguous",
    rows.slice(0, 8).map((row) => ({ id: row.id, label: labelOf(row) }))
  );
}

export type FlatFolder = {
  id: string;
  parentFolderId: string | null;
  name: string;
  order: number;
};

export type FlatFile = {
  id: string;
  folderId: string | null;
  parentFileId: string | null;
  title: string;
  order: number;
  kind?: string;
};

export type FileNode = {
  id: string;
  title: string;
  order: number;
  kind: string | null;
  children: FileNode[];
};

export type FolderNode = {
  id: string;
  name: string;
  order: number;
  folders: FolderNode[];
  files: FileNode[];
};

function byOrder<T extends { order: number; id: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function fileNodes(files: FlatFile[], parentFileId: string | null, folderId: string | null): FileNode[] {
  return byOrder(
    files.filter((file) => file.parentFileId === parentFileId && (parentFileId ? true : file.folderId === folderId))
  ).map((file) => ({
    id: file.id,
    title: file.title,
    order: file.order,
    kind: file.kind ?? null,
    children: fileNodes(files, file.id, file.folderId),
  }));
}

export function nestTree(folders: FlatFolder[], files: FlatFile[]) {
  function folderNodes(parentFolderId: string | null): FolderNode[] {
    return byOrder(folders.filter((folder) => folder.parentFolderId === parentFolderId)).map((folder) => ({
      id: folder.id,
      name: folder.name,
      order: folder.order,
      folders: folderNodes(folder.id),
      files: fileNodes(files, null, folder.id),
    }));
  }
  return {
    folders: folderNodes(null),
    files: fileNodes(files, null, null),
  };
}

export function documentPath(opts: {
  workspaceName: string;
  folderId: string | null;
  fileId: string;
  folders: { id: string; parentFolderId: string | null; name: string }[];
  files: { id: string; parentFileId: string | null; title: string }[];
}) {
  const folders = new Map(opts.folders.map((folder) => [folder.id, folder]));
  const files = new Map(opts.files.map((file) => [file.id, file]));
  const folderParts: string[] = [];
  let folderId = opts.folderId;
  const seenFolders = new Set<string>();
  while (folderId && !seenFolders.has(folderId)) {
    seenFolders.add(folderId);
    const folder = folders.get(folderId);
    if (!folder) break;
    folderParts.unshift(folder.name);
    folderId = folder.parentFolderId;
  }
  const fileParts: string[] = [];
  let fileId: string | null = opts.fileId;
  const seenFiles = new Set<string>();
  while (fileId && !seenFiles.has(fileId)) {
    seenFiles.add(fileId);
    const file = files.get(fileId);
    if (!file) break;
    fileParts.unshift(file.title);
    fileId = file.parentFileId;
  }
  return [opts.workspaceName, ...folderParts, ...fileParts].join("/");
}

export type BulkFile = { title: string; markdown?: string; kind?: string; children?: BulkFile[] };
export type BulkFolder = { name: string; folders?: BulkFolder[]; files?: BulkFile[] };
export type BulkTree = {
  workspace: string;
  description?: string;
  color?: string;
  icon?: string;
  folders?: BulkFolder[];
  files?: BulkFile[];
};

function asRecord(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TreeError(`${label} inválido.`, "invalid");
  }
  return value as Record<string, unknown>;
}

function parseFiles(value: unknown, depth: number): BulkFile[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TreeError("files precisa ser uma lista.", "invalid");
  assertDepth(depth);
  return value.map((item) => {
    const row = asRecord(item, "Arquivo");
    const title = String(row.title ?? "").trim();
    if (!title) throw new TreeError("Arquivo sem título.", "invalid");
    return {
      title,
      markdown: row.markdown === undefined ? undefined : String(row.markdown),
      kind: row.kind === undefined ? undefined : String(row.kind),
      children: parseFiles(row.children, depth + 1),
    };
  });
}

function parseFolders(value: unknown, depth: number): BulkFolder[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TreeError("folders precisa ser uma lista.", "invalid");
  assertDepth(depth);
  return value.map((item) => {
    const row = asRecord(item, "Pasta");
    const name = String(row.name ?? "").trim();
    if (!name) throw new TreeError("Pasta sem nome.", "invalid");
    return {
      name,
      folders: parseFolders(row.folders, depth + 1),
      files: parseFiles(row.files, depth + 1),
    };
  });
}

export function parseBulkTree(raw: unknown): BulkTree {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      throw new TreeError("Árvore inválida. Envie um JSON.", "invalid");
    }
  }
  const row = asRecord(value, "Árvore");
  const workspace = String(row.workspace ?? row.name ?? "").trim();
  if (!workspace) throw new TreeError("Informe o nome do espaço.", "invalid");
  return {
    workspace,
    description: row.description === undefined ? undefined : String(row.description),
    color: row.color === undefined ? undefined : String(row.color),
    icon: row.icon === undefined ? undefined : String(row.icon),
    folders: parseFolders(row.folders, 1),
    files: parseFiles(row.files, 1),
  };
}

export function folderMoveBlockReason(folder: { opportunityId?: string | null; name: string }) {
  if (folder.opportunityId) return "Pasta ligada a uma oportunidade fica no espaço Oportunidades.";
  if (folder.name === TEMPLATES_FOLDER_NAME) return "A pasta _Templates não muda de lugar.";
  return null;
}
