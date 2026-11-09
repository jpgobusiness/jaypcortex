import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseDatePhrase } from "@/lib/activities/dates";
import { resolveAgentId } from "@/lib/knowledge/search";
import { buildAgentContext } from "@/lib/cortex/context";
import { route } from "@/lib/cortex/router";
import { asAgentRouting } from "@/lib/cortex/routing-schema";
import { hasScope, type McpScope } from "@/lib/mcp/tokens";
import { busyBlocksJson } from "@/lib/mcp/activity-schemas";
import { readMeta, type ToolServer } from "@/lib/mcp/annotations";
import { parseBusyBlocks } from "@/lib/mcp/quick-compat";

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function assertScope(scopes: string[], needed: McpScope | McpScope[]) {
  if (!hasScope(scopes, needed)) throw new Error("Token sem permissão para esta tool");
}

const TOOL_GUIDE: Record<string, string> = {
  list_activities: "Listar tarefas vivas. Padrão pendentes. Use total/counts; não trate a página como o universo. Nunca use search_knowledge para isso.",
  get_activity: "Detalhe de uma tarefa (id ou query).",
  search_activities: "Buscar tarefa por título/texto.",
  get_queue: "Fila de execução.",
  get_daily_briefing: "Cérebro do dia (top 3, atrasadas, alertas).",
  get_weekly_review: "Revisão da semana.",
  plan_day: "Encaixar tarefas nos horários livres (só leitura). Para gravar use apply_day_plan.",
  apply_day_plan: "Grava o plano do dia nas tarefas.",
  create_activity: "Criar uma tarefa. Datas em PT-BR.",
  create_activities_bulk: "Criar até 30 tarefas.",
  update_activity: "Editar campos.",
  start_activity: "Iniciar cronômetro.",
  pause_activity: "Pausar cronômetro.",
  complete_activity: "Concluir. Se houver >1 candidato, confirme.",
  reopen_activity: "Reabrir.",
  delete_activity: "Lixeira. Sempre confirmar.",
  restore_activity: "Tirar da lixeira.",
  queue_activity: "Colocar na fila.",
  unqueue_activity: "Tirar da fila.",
  reschedule_activity: "Mudar prazo/bloco.",
  add_reminder: "Lembrete no briefing.",
  add_subtask: "Subtarefa.",
  search_knowledge: "Só documentos da base. Não contém tarefas.",
  read_document: "Ler um documento da base. Não contém tarefas.",
  list_documents: "Catálogo da base. Não contém tarefas.",
  list_opportunity_folders: "Pastas do espaço Oportunidades (1 pasta = 1 oportunidade).",
  create_opportunity_folder: "Cria pasta + Contexto + Proposal Doc. Idempotente pelo nome.",
  create_file_in_folder: "Cria arquivo na pasta da oportunidade.",
  get_document_outline: "Sumário de seções + content_hash.",
  read_section: "Lê o markdown de uma seção.",
  upsert_section: "Grava uma seção (só o trecho). Passe expected_hash.",
  append_to_document: "Acrescenta no fim do arquivo.",
  link_opportunity_folder: "Liga a pasta a uma Opportunity do funil.",
  delete_section: "Apaga uma seção. Passe expected_hash. Heading inexistente → not_found.",
  import_transcript: "Grava texto já transcrito (Quick transcreve o áudio). Acima de 5 MB divide.",
  register_delivery: "Grava o HTML da proposta no Storage e devolve URL assinada.",
  get_proposal_template: "HTML base + mapa H2 → placeholder para montar a entrega.",
  get_agent_prompt: "Vestir o prompt do agente.",
  get_agent: "Config do agente. Não executa nada.",
  list_agents: "Quem existe no escritório.",
  cortex: "Porta de entrada. Chame sempre primeiro.",
};

export function registerCortexTools(
  server: ToolServer,
  ctx: { tokenId: string; profileId: string; scopes: string[] }
) {
  const wrap = async (fn: () => Promise<unknown>) => {
    try {
      return text(await fn());
    } catch (err) {
      console.error("cortex tool", err);
      return text({ error: err instanceof Error ? err.message : "Erro interno" });
    }
  };

  server.registerTool("cortex", {
    ...readMeta("Porta de entrada"),
    description:
      "PORTA DE ENTRADA. Chame SEMPRE primeiro para qualquer pedido sobre a plataforma JayP Cortex (tarefas, agenda, prioridades, metodologia, agentes, MAP). Retorna qual agente atende, o prompt dele, conhecimento relevante, dados vivos e as tools a executar em seguida.",
    inputSchema: z.object({
      request: z.string(),
      date: z.string().optional(),
      busy_blocks: busyBlocksJson,
      agent_hint: z.string().optional(),
      include_knowledge: z.boolean().optional(),
    }),
  }, async (args) => {
    assertScope(ctx.scopes, "read");
    return wrap(async () => {
      const started = Date.now();
      const request = String(args.request || "").trim();
      if (!request) return { error: "Informe request" };
      const date = args.date ? parseDatePhrase(String(args.date))?.date : undefined;
      const busy = parseBusyBlocks(args.busy_blocks);
      const hint = args.agent_hint ? String(args.agent_hint) : undefined;
      const routed = await route(request, { agentHint: hint, includeFts: true });
      const slug = routed.agent?.slug || hint || "cortex";
      const pack = await buildAgentContext({
        slug,
        request,
        routed,
        date,
        busyBlocks: busy,
        includeKnowledge: args.include_knowledge !== false,
        scopes: ctx.scopes,
      });
      let route_log_id: string | null = null;
      try {
        const log = await prisma.cortexRouteLog.create({
          data: {
            request,
            normalized: routed.normalized,
            agentSlug: routed.agent?.slug ?? null,
            mode: routed.mode,
            intentKey: routed.intent?.key ?? null,
            confidence: routed.confidence,
            reasons: routed.reasons as object,
            candidates: routed.candidates as object,
            actorId: ctx.profileId || null,
            source: "mcp",
            latencyMs: Date.now() - started,
          },
        });
        route_log_id = log.id;
      } catch (err) {
        console.error("cortex route log", err);
      }
      return { ...pack, route_log_id };
    });
  });

  server.registerTool("get_agent_context", {
    ...readMeta("Contexto do agente"),
    description: "Pacote do agente (prompt + conhecimento + dados vivos + tools sugeridas) sem roteamento. Passe o slug.",
    inputSchema: z.object({
      agent: z.string(),
      request: z.string(),
      date: z.string().optional(),
      busy_blocks: busyBlocksJson,
    }),
  }, async (args) => {
    assertScope(ctx.scopes, "read");
    return wrap(async () => {
      const agent = String(args.agent || "");
      const id = await resolveAgentId(agent);
      if (!id) return { error: "Agente não encontrado" };
      const row = await prisma.agent.findUnique({ where: { id }, select: { slug: true } });
      const date = args.date ? parseDatePhrase(String(args.date))?.date : undefined;
      const busy = parseBusyBlocks(args.busy_blocks);
      return buildAgentContext({
        slug: row?.slug || agent,
        request: String(args.request || ""),
        date,
        busyBlocks: busy,
        scopes: ctx.scopes,
      });
    });
  });

  server.registerTool("list_agent_tools", {
    ...readMeta("Tools do agente"),
    description: "Tools permitidas daquele agente e quando usar cada uma.",
    inputSchema: z.object({ agent: z.string() }),
  }, async (args) => {
    assertScope(ctx.scopes, "read");
    return wrap(async () => {
      const id = await resolveAgentId(String(args.agent));
      if (!id) return { error: "Agente não encontrado" };
      const row = await prisma.agent.findUnique({
        where: { id },
        select: { slug: true, name: true, routing: true },
      });
      const routing = asAgentRouting(row?.routing);
      const names = routing.allowed_tools?.length
        ? routing.allowed_tools
        : ["search_knowledge", "read_document", "list_documents", "get_agent_prompt"];
      return {
        agent: { slug: row?.slug, name: row?.name },
        tools: names.map((name) => ({
          tool: name,
          when: TOOL_GUIDE[name] || "Usar quando o intent do agente pedir.",
        })),
      };
    });
  });

  server.registerPrompt?.("cortex_start", {
    title: "Começar pelo Cortex",
    description: "Fluxo padrão: chamar cortex primeiro, vestir o prompt, executar suggested_tools.",
  }, async () => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: [
          "1) chame `cortex` com o pedido (e busy_blocks se tiver agenda);",
          "2) responda vestindo `agent_prompt`;",
          "3) execute `suggested_tools` em ordem;",
          "4) confirme com o usuário as que tiverem `requires_confirmation`;",
          "5) resposta curta, pronta para voz.",
        ].join(" "),
      },
    }],
  }));
}
