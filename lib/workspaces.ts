// Helpers dos Espaços de Trabalho (usados no cliente e nas APIs).

import type {
  EditorDocument,
  WorkspaceFileSummary,
  WorkspaceFolder,
  WorkspaceTree,
} from "@/lib/types";

export const WORKSPACE_COLORS = [
  { value: "#7b68ee", label: "Roxo" },
  { value: "#2563eb", label: "Azul" },
  { value: "#0891b2", label: "Ciano" },
  { value: "#16a34a", label: "Verde" },
  { value: "#ca8a04", label: "Amarelo" },
  { value: "#ea580c", label: "Laranja" },
  { value: "#db2777", label: "Rosa" },
  { value: "#dc2626", label: "Vermelho" },
  { value: "#475569", label: "Cinza" },
] as const;

export const DEFAULT_WORKSPACE_COLOR = WORKSPACE_COLORS[0].value;
export const DEFAULT_FILE_TITLE = "Sem título";

export const NAME_MAX_LENGTH = 80;
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 500;
/** Limite do documento salvo (caracteres do JSON). */
export const CONTENT_MAX_LENGTH = 5_000_000;
const EXCERPT_MAX_LENGTH = 200;

export function workspaceHref(workspaceId: string) {
  return `/espacos/${workspaceId}`;
}

/** Sala de um agente (prompt/base ficam no Escritório, não na lista de espaços). */
export function isAgentRoom(workspace: { name?: string; agent?: unknown | null }) {
  if (workspace.agent) return true;
  return /^sala de /i.test((workspace.name ?? "").trim());
}

export function fileHref(workspaceId: string, fileId: string) {
  return `/espacos/${workspaceId}/arquivos/${fileId}`;
}

export function folderHref(workspaceId: string, folderId: string) {
  return `/espacos/${workspaceId}/pastas/${folderId}`;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export const NAME_TOO_LONG = `O nome pode ter até ${NAME_MAX_LENGTH} caracteres`;
export const TITLE_TOO_LONG = `O título pode ter até ${TITLE_MAX_LENGTH} caracteres`;
export const DESCRIPTION_TOO_LONG = `A descrição pode ter até ${DESCRIPTION_MAX_LENGTH} caracteres`;

export function isEditorDocument(value: unknown): value is EditorDocument {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === "doc"
  );
}

/** Lê o documento salvo no banco. Texto vazio ou inválido vira null. */
export function parseEditorDocument(raw: string): EditorDocument | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isEditorDocument(value) ? value : null;
  } catch {
    return null;
  }
}

/** Texto puro do início do documento, para prévias. */
export function documentExcerpt(doc: EditorDocument): string {
  const parts: string[] = [];
  let length = 0;

  function walk(node: EditorDocument) {
    if (length > EXCERPT_MAX_LENGTH) return;
    if (typeof node.text === "string") {
      parts.push(node.text);
      length += node.text.length;
      return;
    }
    node.content?.forEach(walk);
    // Separa blocos (parágrafos, itens de lista, quebras de linha).
    parts.push(" ");
  }

  walk(doc);
  return parts.join("").replace(/\s+/g, " ").trim().slice(0, EXCERPT_MAX_LENGTH);
}

/** Data e hora curtas em pt-BR (ex.: 22 de out., 17:40). */
export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Todos os arquivos do espaço: soltos e dentro das pastas. */
export function workspaceFiles(workspace: WorkspaceTree): WorkspaceFileSummary[] {
  return [
    ...workspace.files,
    ...workspace.folders.flatMap((folder) => folder.files),
  ];
}

/** Data da alteração mais recente no espaço (ele, as pastas ou os arquivos). */
export function lastWorkspaceUpdate(workspace: WorkspaceTree): string {
  const dates = [
    workspace.updatedAt,
    ...workspace.folders.map((folder) => folder.updatedAt),
    ...workspaceFiles(workspace).map((file) => file.updatedAt),
  ];
  return dates.reduce((latest, date) => (date > latest ? date : latest));
}

/** Data da alteração mais recente na pasta (ela ou os arquivos). */
export function lastFolderUpdate(folder: WorkspaceFolder): string {
  const dates = [folder.updatedAt, ...folder.files.map((file) => file.updatedAt)];
  return dates.reduce((latest, date) => (date > latest ? date : latest));
}

/** Ex.: countLabel(1, "pasta", "pastas") → "1 pasta". */
export function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}
