import { prisma } from "@/lib/prisma";
import { contentHash } from "@/lib/knowledge/hash";
import { isDocumentKind } from "@/lib/knowledge/kinds";
import { upsertFileContent } from "@/lib/knowledge/files";
import { markdownToTiptap } from "@/lib/knowledge/markdown";
import { writeAudit } from "@/lib/mcp/audit";
import { MCP_ISSUER } from "@/lib/mcp/http";
import { nextFolderOrder, nextWorkspaceOrder } from "@/lib/workspaces-db";
import { parseEditorDocument } from "@/lib/workspaces";
import type { EditorDocument } from "@/lib/types";
import {
  SectionNotFoundError,
  appendToDocument,
  deleteSection,
  outline,
  readSection,
  upsertSection,
} from "@/lib/tiptap/sections";
import { transcriptTitle } from "./format";
import { getProposalTemplate } from "./html-template";
import {
  removeOpportunityObject,
  SIGNED_URL_SECONDS,
  signedOpportunityUrl,
  slugify,
  uploadOpportunityObject,
} from "./storage";
import {
  parseTranscriptFile,
  splitTranscriptParts,
  transcriptPartTitles,
} from "./transcript";
import {
  CONTEXT_TEMPLATE_TITLE,
  OPPORTUNITIES_KEY,
  PROPOSAL_TEMPLATE_TITLE,
  TEMPLATES_FOLDER,
  cloneDoc,
  contextTemplateDoc,
  proposalTemplateDoc,
} from "./templates";

export class OpportunityConflictError extends Error {
  content_hash: string;
  constructor(hash: string) {
    super("conflict");
    this.name = "OpportunityConflictError";
    this.content_hash = hash;
  }
}

export function filePublicUrl(workspaceId: string, fileId: string) {
  return `${MCP_ISSUER}/espacos/${workspaceId}/arquivos/${fileId}`;
}

export async function getOpportunitiesWorkspace() {
  const workspace = await prisma.workspace.findUnique({ where: { key: OPPORTUNITIES_KEY } });
  if (!workspace) throw new Error("Espaço Oportunidades não encontrado. Rode npm run seed:opportunities.");
  return workspace;
}

export async function ensureOpportunitiesWorkspace() {
  const existing = await prisma.workspace.findUnique({ where: { key: OPPORTUNITIES_KEY } });
  if (existing) return existing;
  const byName = await prisma.workspace.findFirst({
    where: { name: "Oportunidades", key: null },
    include: { agent: { select: { id: true } } },
  });
  if (byName && !byName.agent) {
    return prisma.workspace.update({
      where: { id: byName.id },
      data: { key: OPPORTUNITIES_KEY },
    });
  }
  return prisma.workspace.create({
    data: {
      name: "Oportunidades",
      key: OPPORTUNITIES_KEY,
      description: "Uma pasta = uma oportunidade. Contexto, transcrição e Proposal Doc.",
      color: "#ea580c",
      order: await nextWorkspaceOrder(),
    },
  });
}

async function findTemplateFile(title: string) {
  const workspace = await getOpportunitiesWorkspace();
  const folder = await prisma.workspaceFolder.findFirst({
    where: { workspaceId: workspace.id, name: TEMPLATES_FOLDER },
  });
  if (!folder) return null;
  return prisma.workspaceFile.findFirst({
    where: { workspaceId: workspace.id, folderId: folder.id, title },
  });
}

function templateDoc(title: string, fallback: EditorDocument, source: { content: string } | null): EditorDocument {
  if (source) {
    const parsed = parseEditorDocument(source.content);
    if (parsed) return cloneDoc(parsed);
  }
  return cloneDoc(fallback);
}

async function latestRevisionId(fileId: string) {
  const revision = await prisma.fileRevision.findFirst({
    where: { fileId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return revision?.id ?? null;
}

const funnelSelect = {
  id: true,
  name: true,
  client: true,
  value: true,
  stage: { select: { id: true, name: true, color: true } },
} as const;

async function writeFileDoc(opts: {
  fileId: string;
  title: string;
  doc: EditorDocument;
  createdBy?: string | null;
  source?: string;
  note?: string | null;
}) {
  const saved = await upsertFileContent({
    fileId: opts.fileId,
    title: opts.title,
    content: opts.doc,
    createdBy: opts.createdBy,
    source: opts.source ?? "mcp",
    note: opts.note,
  });
  return {
    file: saved.file,
    revision_id: saved.file ? await latestRevisionId(saved.file.id) : null,
    content_hash: saved.hash,
    url: saved.file ? filePublicUrl(saved.file.workspaceId, saved.file.id) : "",
  };
}

async function uniqueTranscriptTitles(workspaceId: string, folderId: string, titles: string[]) {
  const used = new Set(
    (await prisma.workspaceFile.findMany({
      where: { workspaceId, folderId },
      select: { title: true },
    })).map((row) => row.title)
  );
  return titles.map((base) => {
    if (!used.has(base)) {
      used.add(base);
      return base;
    }
    let n = 2;
    let next = `${base} (${n})`;
    while (used.has(next)) {
      n += 1;
      next = `${base} (${n})`;
    }
    used.add(next);
    return next;
  });
}

function assertHash(file: { content: string; title: string; contentHash: string | null }, expected?: string) {
  const current = file.contentHash || contentHash(file.content, file.title);
  if (expected && expected !== current) throw new OpportunityConflictError(current);
  return current;
}

async function copyTemplateFile(opts: {
  workspaceId: string;
  folderId: string;
  title: string;
  kind: string;
  doc: EditorDocument;
  createdBy?: string | null;
  source?: string;
}) {
  const source = opts.source ?? "mcp";
  const existing = await prisma.workspaceFile.findFirst({
    where: { workspaceId: opts.workspaceId, folderId: opts.folderId, title: opts.title },
  });
  if (existing) return existing;
  const saved = await upsertFileContent({
    workspaceId: opts.workspaceId,
    folderId: opts.folderId,
    title: opts.title,
    content: opts.doc,
    kind: opts.kind,
    createdBy: opts.createdBy,
    source,
  });
  if (!saved.file) throw new Error("Falha ao criar o arquivo");
  return prisma.workspaceFile.findUniqueOrThrow({ where: { id: saved.file.id } });
}

export async function listOpportunityFolders() {
  const workspace = await getOpportunitiesWorkspace();
  const folders = await prisma.workspaceFolder.findMany({
    where: { workspaceId: workspace.id, NOT: { name: TEMPLATES_FOLDER } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      files: {
        select: { id: true, title: true, kind: true, updatedAt: true, contentHash: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  return {
    workspace_id: workspace.id,
    folders: folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      opportunity_id: folder.opportunityId,
      files: folder.files.map((file) => ({
        id: file.id,
        title: file.title,
        kind: file.kind,
        updated_at: file.updatedAt.toISOString(),
        url: filePublicUrl(workspace.id, file.id),
      })),
    })),
  };
}

export async function createOpportunityFolder(opts: {
  name: string;
  opportunity_id?: string;
  createdBy?: string | null;
  source?: string;
  tokenId?: string | null;
}) {
  const name = opts.name.trim();
  if (!name) throw new Error("Informe name");
  if (name === TEMPLATES_FOLDER) throw new Error("Nome reservado");
  const workspace = await getOpportunitiesWorkspace();
  if (opts.opportunity_id) {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: opts.opportunity_id } });
    if (!opportunity) throw new Error("Oportunidade do funil não encontrada");
  }
  const existing = await prisma.workspaceFolder.findFirst({
    where: { workspaceId: workspace.id, name },
  });
  const folder = existing ?? await prisma.workspaceFolder.create({
    data: {
      workspaceId: workspace.id,
      name,
      opportunityId: opts.opportunity_id || null,
      order: await nextFolderOrder(workspace.id),
    },
  });
  if (!folder.opportunityId && opts.opportunity_id) {
    await prisma.workspaceFolder.update({
      where: { id: folder.id },
      data: { opportunityId: opts.opportunity_id },
    });
  }

  const contextTpl = await findTemplateFile(CONTEXT_TEMPLATE_TITLE);
  const proposalTpl = await findTemplateFile(PROPOSAL_TEMPLATE_TITLE);
  const context = await copyTemplateFile({
    workspaceId: workspace.id,
    folderId: folder.id,
    title: "Contexto",
    kind: "contexto",
    doc: templateDoc(CONTEXT_TEMPLATE_TITLE, contextTemplateDoc(), contextTpl),
    createdBy: opts.createdBy,
    source: opts.source,
  });
  const proposal = await copyTemplateFile({
    workspaceId: workspace.id,
    folderId: folder.id,
    title: "Proposal Doc",
    kind: "proposal_doc",
    doc: templateDoc(PROPOSAL_TEMPLATE_TITLE, proposalTemplateDoc(), proposalTpl),
    createdBy: opts.createdBy,
    source: opts.source,
  });

  await writeAudit({
    actorId: opts.createdBy,
    actorType: opts.source === "ui" ? "user" : "mcp",
    tokenId: opts.tokenId,
    action: "create_opportunity_folder",
    entity: "WorkspaceFolder",
    entityId: folder.id,
    meta: { name, idempotent: Boolean(existing) },
  });

  return {
    folder_id: folder.id,
    name: folder.name,
    created: !existing,
    files: [
      { file_id: context.id, title: context.title, kind: context.kind, url: filePublicUrl(workspace.id, context.id) },
      { file_id: proposal.id, title: proposal.title, kind: proposal.kind, url: filePublicUrl(workspace.id, proposal.id) },
    ],
  };
}

export async function listFunnelOpportunities() {
  const rows = await prisma.opportunity.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      ...funnelSelect,
      folders: { select: { id: true, name: true, workspaceId: true } },
    },
  });
  return rows;
}

export async function getFunnelOpportunity(id: string) {
  const row = await prisma.opportunity.findUnique({
    where: { id },
    select: {
      ...funnelSelect,
      description: true,
      folders: {
        include: {
          files: {
            select: { id: true, title: true, kind: true, updatedAt: true, workspaceId: true },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
  if (!row) throw new Error("Oportunidade do funil não encontrada");
  return {
    ...row,
    folders: row.folders.map((folder) => ({
      ...folder,
      files: folder.files.map((file) => ({
        ...file,
        url: filePublicUrl(file.workspaceId, file.id),
      })),
    })),
  };
}

export async function linkOpportunityFolder(opts: {
  folder_id: string;
  opportunity_id?: string;
  createdBy?: string | null;
  source?: string;
  tokenId?: string | null;
}) {
  const folder = await prisma.workspaceFolder.findUnique({ where: { id: opts.folder_id } });
  if (!folder) throw new Error("Pasta não encontrada");
  const opportunityId = opts.opportunity_id?.trim() || null;
  if (opportunityId) {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
    if (!opportunity) throw new Error("Oportunidade do funil não encontrada");
  }
  const updated = await prisma.workspaceFolder.update({
    where: { id: folder.id },
    data: { opportunityId },
    include: {
      opportunity: { select: funnelSelect },
    },
  });
  await writeAudit({
    actorId: opts.createdBy,
    actorType: opts.source === "ui" ? "user" : "mcp",
    tokenId: opts.tokenId,
    action: "link_opportunity_folder",
    entity: "WorkspaceFolder",
    entityId: folder.id,
    meta: { opportunity_id: opportunityId },
  });
  return {
    folder_id: updated.id,
    name: updated.name,
    opportunity_id: updated.opportunityId,
    opportunity: updated.opportunity,
  };
}

export async function createFileInFolder(opts: {
  folder_id: string;
  title: string;
  kind: string;
  markdown?: string;
  template_id?: string;
  createdBy?: string | null;
  source?: string;
  tokenId?: string | null;
}) {
  const title = opts.title.trim();
  if (!title) throw new Error("Informe title");
  const folder = await prisma.workspaceFolder.findUnique({ where: { id: opts.folder_id } });
  if (!folder) throw new Error("Pasta não encontrada");
  const kind = isDocumentKind(opts.kind) ? opts.kind : "nota";
  const existing = await prisma.workspaceFile.findFirst({
    where: { workspaceId: folder.workspaceId, folderId: folder.id, title },
  });
  if (existing) {
    return {
      file_id: existing.id,
      section_id: null,
      content_hash: existing.contentHash || contentHash(existing.content, existing.title),
      revision_id: await latestRevisionId(existing.id),
      url: filePublicUrl(existing.workspaceId, existing.id),
    };
  }
  let doc: EditorDocument | string;
  if (opts.template_id) {
    const template = await prisma.workspaceFile.findUnique({ where: { id: opts.template_id } });
    if (!template) throw new Error("Template não encontrado");
    const parsed = parseEditorDocument(template.content);
    doc = parsed ? cloneDoc(parsed) : markdownToTiptap(opts.markdown || "");
  } else {
    doc = opts.markdown || "";
  }
  const saved = await upsertFileContent({
    workspaceId: folder.workspaceId,
    folderId: folder.id,
    title,
    content: doc,
    kind,
    createdBy: opts.createdBy,
    source: opts.source ?? "mcp",
  });
  await writeAudit({
    actorId: opts.createdBy,
    actorType: opts.source === "ui" ? "user" : "mcp",
    tokenId: opts.tokenId,
    action: "create_file_in_folder",
    entity: "WorkspaceFile",
    entityId: saved.file?.id,
  });
  return {
    file_id: saved.file?.id,
    section_id: null,
    content_hash: saved.hash,
    revision_id: saved.file ? await latestRevisionId(saved.file.id) : null,
    url: saved.file ? filePublicUrl(saved.file.workspaceId, saved.file.id) : "",
  };
}

export async function getDocumentOutline(fileId: string) {
  const file = await prisma.workspaceFile.findUnique({ where: { id: fileId } });
  if (!file) throw new Error("Arquivo não encontrado");
  const doc = parseEditorDocument(file.content) ?? { type: "doc", content: [] };
  return {
    file_id: file.id,
    title: file.title,
    content_hash: file.contentHash || contentHash(file.content, file.title),
    sections: outline(doc).map(({ start, end, ...rest }) => rest),
    url: filePublicUrl(file.workspaceId, file.id),
  };
}

export async function readDocumentSection(opts: { file_id: string; section_id?: string; heading?: string }) {
  const file = await prisma.workspaceFile.findUnique({ where: { id: opts.file_id } });
  if (!file) throw new Error("Arquivo não encontrado");
  const doc = parseEditorDocument(file.content) ?? { type: "doc", content: [] };
  const result = readSection(doc, { section_id: opts.section_id, heading: opts.heading });
  return {
    file_id: file.id,
    section_id: result.section.section_id,
    heading: result.section.heading,
    markdown: result.markdown,
    content_hash: file.contentHash || contentHash(file.content, file.title),
    warning: result.warning,
    url: filePublicUrl(file.workspaceId, file.id),
  };
}

export async function upsertDocumentSection(opts: {
  file_id: string;
  heading: string;
  markdown: string;
  after_heading?: string;
  expected_hash?: string;
  createdBy?: string | null;
  source?: string;
  tokenId?: string | null;
}) {
  const file = await prisma.workspaceFile.findUnique({ where: { id: opts.file_id } });
  if (!file) throw new Error("Arquivo não encontrado");
  assertHash(file, opts.expected_hash);
  const doc = parseEditorDocument(file.content) ?? { type: "doc", content: [] };
  const result = upsertSection(doc, {
    heading: opts.heading,
    markdown: opts.markdown,
    after_heading: opts.after_heading,
  });
  const saved = await writeFileDoc({
    fileId: file.id,
    title: file.title,
    doc: result.doc,
    createdBy: opts.createdBy,
    source: opts.source,
    note: opts.heading,
  });
  await writeAudit({
    actorId: opts.createdBy,
    actorType: opts.source === "ui" ? "user" : "mcp",
    tokenId: opts.tokenId,
    action: "upsert_section",
    entity: "WorkspaceFile",
    entityId: file.id,
    meta: { heading: opts.heading, section_id: result.section.section_id, created: result.created },
  });
  return {
    file_id: file.id,
    section_id: result.section.section_id,
    content_hash: saved.content_hash,
    revision_id: saved.revision_id,
    url: saved.url,
  };
}

export async function deleteDocumentSection(opts: {
  file_id: string;
  heading: string;
  expected_hash?: string;
  createdBy?: string | null;
  source?: string;
  tokenId?: string | null;
}) {
  const heading = opts.heading.trim();
  if (!heading) throw new SectionNotFoundError("");
  const file = await prisma.workspaceFile.findUnique({ where: { id: opts.file_id } });
  if (!file) throw new Error("Arquivo não encontrado");
  assertHash(file, opts.expected_hash);
  const doc = parseEditorDocument(file.content) ?? { type: "doc", content: [] };
  const result = deleteSection(doc, heading);
  const saved = await writeFileDoc({
    fileId: file.id,
    title: file.title,
    doc: result.doc,
    createdBy: opts.createdBy,
    source: opts.source,
    note: heading,
  });
  await writeAudit({
    actorId: opts.createdBy,
    actorType: opts.source === "ui" ? "user" : "mcp",
    tokenId: opts.tokenId,
    action: "delete_section",
    entity: "WorkspaceFile",
    entityId: file.id,
    meta: { heading },
  });
  return {
    file_id: file.id,
    heading,
    content_hash: saved.content_hash,
    revision_id: saved.revision_id,
    url: saved.url,
    warning: result.warning,
  };
}

export async function importTranscript(opts: {
  folder_id: string;
  title?: string;
  text: string;
  createdBy?: string | null;
  source?: string;
  tokenId?: string | null;
}) {
  const cleaned = parseTranscriptFile({ text: opts.text });
  if (!cleaned.trim()) throw new Error("Transcrição vazia");
  const parts = splitTranscriptParts(cleaned);
  const folder = await prisma.workspaceFolder.findUnique({ where: { id: opts.folder_id } });
  if (!folder) throw new Error("Pasta não encontrada");
  const titles = await uniqueTranscriptTitles(
    folder.workspaceId,
    folder.id,
    transcriptPartTitles(opts.title?.trim() || transcriptTitle(), parts.length)
  );
  const files = [];
  for (let i = 0; i < parts.length; i++) {
    files.push(await createFileInFolder({
      folder_id: opts.folder_id,
      title: titles[i],
      kind: "transcricao",
      markdown: parts[i],
      createdBy: opts.createdBy,
      source: opts.source,
      tokenId: opts.tokenId,
    }));
  }
  return {
    files,
    parts: parts.length,
    split: parts.length > 1,
  };
}

export async function importTranscriptUpload(opts: {
  folder_id: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  createdBy?: string | null;
  source?: string;
  tokenId?: string | null;
}) {
  const text = parseTranscriptFile({
    name: opts.filename,
    mime: opts.mimeType,
    bytes: opts.bytes,
  });
  const result = await importTranscript({
    folder_id: opts.folder_id,
    text,
    createdBy: opts.createdBy,
    source: opts.source,
    tokenId: opts.tokenId,
  });
  let warning: string | undefined;
  try {
    await storeFolderAsset({
      folderId: opts.folder_id,
      kind: "anexo",
      name: opts.filename,
      mimeType: opts.mimeType || "application/octet-stream",
      bytes: opts.bytes,
      createdBy: opts.createdBy,
      source: opts.source ?? "ui",
    });
  } catch {
    warning = "Transcrição gravada; original não foi ao Storage (rode npm run db:bucket).";
  }
  return { ...result, warning };
}

const ASSET_KINDS = new Set(["entrega", "anexo", "audio"]);

function publicAsset(row: {
  id: string;
  folderId: string;
  kind: string;
  name: string;
  mimeType: string;
  size: number;
  source: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    folderId: row.folderId,
    kind: row.kind,
    name: row.name,
    mimeType: row.mimeType,
    size: row.size,
    source: row.source,
    createdAt: row.createdAt,
  };
}

export async function storeFolderAsset(opts: {
  folderId: string;
  kind: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  createdBy?: string | null;
  source?: string;
}) {
  const folder = await prisma.workspaceFolder.findUnique({ where: { id: opts.folderId } });
  if (!folder) throw new Error("Pasta não encontrada");
  const kind = ASSET_KINDS.has(opts.kind) ? opts.kind : "anexo";
  const name = opts.name.trim() || "arquivo";
  const folderKey = kind === "entrega" ? "entregas" : kind === "audio" ? "audio" : "anexos";
  const ext = name.includes(".") ? "" : kind === "entrega" ? ".html" : "";
  const path = `${folder.id}/${folderKey}/${Date.now()}-${slugify(name)}${ext}`;
  await uploadOpportunityObject({ path, bytes: opts.bytes, mimeType: opts.mimeType });
  try {
    const created = await prisma.folderAsset.create({
      data: {
        folderId: folder.id,
        kind,
        name: kind === "entrega" && !name.toLowerCase().endsWith(".html") ? `${name}.html` : name,
        mimeType: opts.mimeType,
        size: opts.bytes.byteLength,
        path,
        createdBy: opts.createdBy ?? null,
        source: opts.source ?? "ui",
      },
    });
    return publicAsset(created);
  } catch (err) {
    await removeOpportunityObject(path).catch(() => undefined);
    throw err;
  }
}

export async function registerDelivery(opts: {
  folder_id: string;
  name: string;
  html: string;
  createdBy?: string | null;
  source?: string;
  tokenId?: string | null;
}) {
  const name = opts.name.trim() || "Proposta";
  const html = opts.html ?? "";
  if (!html.trim()) throw new Error("Informe html");
  const bytes = new TextEncoder().encode(html);
  const asset = await storeFolderAsset({
    folderId: opts.folder_id,
    kind: "entrega",
    name,
    mimeType: "text/html; charset=utf-8",
    bytes,
    createdBy: opts.createdBy,
    source: opts.source ?? "mcp",
  });
  const signed = await getFolderAssetSigned(asset.id);
  await writeAudit({
    actorId: opts.createdBy,
    actorType: opts.source === "ui" ? "user" : "mcp",
    tokenId: opts.tokenId,
    action: "register_delivery",
    entity: "FolderAsset",
    entityId: asset.id,
    meta: { folder_id: opts.folder_id, name: asset.name },
  });
  return {
    asset_id: asset.id,
    url_assinada: signed.url,
    expires_at: signed.expires_at,
    name: asset.name,
  };
}

export async function listFolderAssets(folderId: string, kind?: string) {
  const folder = await prisma.workspaceFolder.findUnique({ where: { id: folderId } });
  if (!folder) throw new Error("Pasta não encontrada");
  const rows = await prisma.folderAsset.findMany({
    where: { folderId, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(publicAsset);
}

export async function getFolderAssetSigned(assetId: string) {
  const asset = await prisma.folderAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw new Error("Arquivo não encontrado");
  const signed = await signedOpportunityUrl(asset.path, SIGNED_URL_SECONDS);
  return {
    ...publicAsset(asset),
    url: signed.url,
    expires_at: signed.expires_at,
  };
}

export async function deleteFolderAsset(assetId: string) {
  const asset = await prisma.folderAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw new Error("Arquivo não encontrado");
  await removeOpportunityObject(asset.path);
  await prisma.folderAsset.delete({ where: { id: asset.id } });
  return { ok: true, id: asset.id };
}

export function loadProposalTemplate(name?: string) {
  return getProposalTemplate(name);
}

export async function seedOpportunitiesWorkspace() {
  const workspace = await ensureOpportunitiesWorkspace();
  let folder = await prisma.workspaceFolder.findFirst({
    where: { workspaceId: workspace.id, name: TEMPLATES_FOLDER },
  });
  if (!folder) {
    folder = await prisma.workspaceFolder.create({
      data: {
        workspaceId: workspace.id,
        name: TEMPLATES_FOLDER,
        order: await nextFolderOrder(workspace.id),
      },
    });
  }
  const proposal = await copyTemplateFile({
    workspaceId: workspace.id,
    folderId: folder.id,
    title: PROPOSAL_TEMPLATE_TITLE,
    kind: "template",
    doc: proposalTemplateDoc(),
    source: "seed",
  });
  const context = await copyTemplateFile({
    workspaceId: workspace.id,
    folderId: folder.id,
    title: CONTEXT_TEMPLATE_TITLE,
    kind: "template",
    doc: contextTemplateDoc(),
    source: "seed",
  });
  return {
    workspace_id: workspace.id,
    folder_id: folder.id,
    files: [
      { id: proposal.id, title: proposal.title },
      { id: context.id, title: context.title },
    ],
  };
}

export async function appendToFile(opts: {
  file_id: string;
  markdown: string;
  expected_hash?: string;
  createdBy?: string | null;
  source?: string;
  tokenId?: string | null;
}) {
  const file = await prisma.workspaceFile.findUnique({ where: { id: opts.file_id } });
  if (!file) throw new Error("Arquivo não encontrado");
  assertHash(file, opts.expected_hash);
  const doc = parseEditorDocument(file.content) ?? { type: "doc", content: [] };
  const next = appendToDocument(doc, opts.markdown);
  const saved = await writeFileDoc({
    fileId: file.id,
    title: file.title,
    doc: next,
    createdBy: opts.createdBy,
    source: opts.source,
  });
  await writeAudit({
    actorId: opts.createdBy,
    actorType: opts.source === "ui" ? "user" : "mcp",
    tokenId: opts.tokenId,
    action: "append_to_document",
    entity: "WorkspaceFile",
    entityId: file.id,
  });
  return {
    file_id: file.id,
    section_id: null,
    content_hash: saved.content_hash,
    revision_id: saved.revision_id,
    url: saved.url,
  };
}
