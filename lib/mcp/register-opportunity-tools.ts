import { z } from "zod";
import { hasScope, type McpScope } from "@/lib/mcp/tokens";
import { readMeta, writeMeta, type ToolServer } from "@/lib/mcp/annotations";
import { SectionNotFoundError } from "@/lib/tiptap/sections";
import {
  OpportunityConflictError,
  appendToFile,
  createFileInFolder,
  createOpportunityFolder,
  resolveOpportunityFolder,
  deleteDocumentSection,
  getDocumentOutline,
  importTranscript,
  linkOpportunityFolder,
  listOpportunityFolders,
  loadProposalTemplate,
  readDocumentSection,
  registerDelivery,
  upsertDocumentSection,
} from "@/lib/opportunities/service";

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function assertScope(scopes: string[], needed: McpScope | McpScope[]) {
  if (!hasScope(scopes, needed)) throw new Error("Token sem permissão para esta tool");
}

function optional(value: unknown) {
  const s = typeof value === "string" ? value.trim() : "";
  return s || undefined;
}

export function registerOpportunityTools(
  server: ToolServer,
  ctx: { tokenId: string; profileId: string; scopes: string[] }
) {
  const actor = { createdBy: ctx.profileId || null, source: "mcp" as const, tokenId: ctx.tokenId };

  const wrap = async (fn: () => Promise<unknown>) => {
    try {
      return text(await fn());
    } catch (err) {
      if (err instanceof OpportunityConflictError) {
        return text({ error: "conflict", content_hash: err.content_hash });
      }
      if (err instanceof SectionNotFoundError) {
        return text({ error: "not_found" });
      }
      console.error("mcp opportunity tool failed", err);
      return text({ error: err instanceof Error ? err.message : "Erro interno" });
    }
  };

  server.registerTool("list_opportunity_folders", {
    ...readMeta("Listar oportunidades"),
    description: "Lista pastas do espaço Oportunidades (1 pasta = 1 oportunidade) com arquivos, kind e url. Não inclui _Templates.",
    inputSchema: z.object({}),
  }, async () => wrap(async () => {
    assertScope(ctx.scopes, "read");
    return listOpportunityFolders();
  }));

  server.registerTool("create_opportunity_folder", {
    ...writeMeta("Nova oportunidade"),
    description: "Cria pasta no espaço Oportunidades + Contexto + Proposal Doc a partir dos templates. Idempotente pelo nome. Informe só o nome do cliente (ex.: TAMURA).",
    inputSchema: z.object({ name: z.string() }).passthrough(),
  }, async (args) => wrap(async () => {
    assertScope(ctx.scopes, "write");
    return createOpportunityFolder({
      name: String(args.name ?? ""),
      opportunity_id: optional(args.opportunity_id),
      ...actor,
    });
  }));

  server.registerTool("create_file_in_folder", {
    ...writeMeta("Criar arquivo na pasta"),
    description: "Cria arquivo na pasta do espaço Oportunidades. folder = nome da pasta (ex.: TAMURA). title = nome do arquivo.",
    inputSchema: z.object({
      folder: z.string(),
      title: z.string(),
    }).passthrough(),
  }, async (args) => wrap(async () => {
    assertScope(ctx.scopes, "write");
    const folder = await resolveOpportunityFolder(String(args.folder ?? args.folder_id ?? ""));
    if (!folder) throw new Error("Pasta não encontrada. Informe o nome (ex.: TAMURA).");
    return createFileInFolder({
      folder_id: folder.id,
      title: String(args.title ?? ""),
      kind: String(args.kind ?? "nota"),
      markdown: optional(args.markdown),
      template_id: optional(args.template_id),
      ...actor,
    });
  }));

  server.registerTool("get_document_outline", {
    ...readMeta("Sumário do documento"),
    description: "Seções do arquivo (section_id, heading, level, order, chars) + content_hash. Operação no JSON TipTap.",
    inputSchema: z.object({ file_id: z.string() }),
  }, async (args) => wrap(async () => {
    assertScope(ctx.scopes, "read");
    return getDocumentOutline(String(args.file_id ?? ""));
  }));

  server.registerTool("read_section", {
    ...readMeta("Ler seção"),
    description: "Lê o markdown de uma seção (do heading até o próximo de nível igual ou superior). Use section_id ou heading.",
    inputSchema: z.object({
      file_id: z.string(),
      section_id: z.string().optional(),
      heading: z.string().optional(),
    }),
  }, async (args) => wrap(async () => {
    assertScope(ctx.scopes, "read");
    return readDocumentSection({
      file_id: String(args.file_id ?? ""),
      section_id: optional(args.section_id),
      heading: optional(args.heading),
    });
  }));

  server.registerTool("upsert_section", {
    ...writeMeta("Gravar seção"),
    description: "Substitui ou cria uma seção no JSON TipTap (só o trecho vira markdown).",
    inputSchema: z.object({
      file_id: z.string(),
      heading: z.string(),
      markdown: z.string(),
    }).passthrough(),
  }, async (args) => wrap(async () => {
    assertScope(ctx.scopes, "write");
    return upsertDocumentSection({
      file_id: String(args.file_id ?? ""),
      heading: String(args.heading ?? ""),
      markdown: String(args.markdown ?? ""),
      after_heading: optional(args.after_heading),
      expected_hash: optional(args.expected_hash),
      ...actor,
    });
  }));

  server.registerTool("link_opportunity_folder", {
    ...writeMeta("Vincular ao funil"),
    description: "Liga a pasta a uma Opportunity do funil. opportunity_id vazio desvincula.",
    inputSchema: z.object({
      folder_id: z.string(),
      opportunity_id: z.string(),
    }),
  }, async (args) => wrap(async () => {
    assertScope(ctx.scopes, "write");
    return linkOpportunityFolder({
      folder_id: String(args.folder_id ?? ""),
      opportunity_id: optional(args.opportunity_id),
      ...actor,
    });
  }));

  server.registerTool("append_to_document", {
    ...writeMeta("Acrescentar ao documento"),
    description: "Acrescenta markdown no fim do arquivo. Não reconverte o doc inteiro.",
    inputSchema: z.object({
      file_id: z.string(),
      markdown: z.string(),
    }).passthrough(),
  }, async (args) => wrap(async () => {
    assertScope(ctx.scopes, "write");
    return appendToFile({
      file_id: String(args.file_id ?? ""),
      markdown: String(args.markdown ?? ""),
      expected_hash: optional(args.expected_hash),
      ...actor,
    });
  }));

  server.registerTool("delete_section", {
    ...writeMeta("Apagar seção", { destructive: true }),
    description: "Remove uma seção pelo heading. Heading inexistente → not_found. Cria revisão restaurável.",
    inputSchema: z.object({
      file_id: z.string(),
      heading: z.string(),
    }).passthrough(),
  }, async (args) => wrap(async () => {
    assertScope(ctx.scopes, "write");
    return deleteDocumentSection({
      file_id: String(args.file_id ?? ""),
      heading: String(args.heading ?? ""),
      expected_hash: optional(args.expected_hash),
      ...actor,
    });
  }));

  server.registerTool("import_transcript", {
    ...writeMeta("Importar transcrição"),
    description: "Grava texto já transcrito como kind=transcricao. Acima de 5 MB divide em (parte N).",
    inputSchema: z.object({
      folder_id: z.string(),
      text: z.string(),
    }).passthrough(),
  }, async (args) => wrap(async () => {
    assertScope(ctx.scopes, "write");
    return importTranscript({
      folder_id: String(args.folder_id ?? ""),
      title: optional(args.title),
      text: String(args.text ?? ""),
      ...actor,
    });
  }));

  server.registerTool("register_delivery", {
    ...writeMeta("Registrar entrega HTML"),
    description: "Grava o HTML da proposta no Storage (bucket privado) e cria FolderAsset kind=entrega. Devolve URL assinada curta.",
    inputSchema: z.object({
      folder_id: z.string(),
      name: z.string(),
      html: z.string(),
    }).passthrough(),
  }, async (args) => wrap(async () => {
    assertScope(ctx.scopes, "write");
    return registerDelivery({
      folder_id: String(args.folder_id ?? ""),
      name: String(args.name ?? ""),
      html: String(args.html ?? ""),
      ...actor,
    });
  }));

  server.registerTool("get_proposal_template", {
    ...readMeta("Template HTML da proposta"),
    description: "Devolve o HTML base e o mapa H2 → placeholder. Sem name usa padrao. Para o agente de código montar a entrega.",
    inputSchema: z.object({
      name: z.string().optional(),
    }),
  }, async (args) => wrap(async () => {
    assertScope(ctx.scopes, "read");
    return loadProposalTemplate(optional(args.name));
  }));
}
