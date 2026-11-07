import { ActivityAmbiguousError, resolveActivity } from "@/lib/activities/service";
import { hasScope, type McpScope } from "@/lib/mcp/tokens";
import { normalize } from "@/lib/cortex/normalize";
import type { CortexIntent, SuggestedTool } from "@/lib/cortex/types";

const DESTRUCTIVE = new Set(["delete_activity", "purge_deleted_activities"]);
const WRITE_TOOLS = new Set([
  "create_activity", "create_activities_bulk", "update_activity",
  "start_activity", "pause_activity", "complete_activity", "reopen_activity",
  "set_activity_status", "delete_activity", "restore_activity",
  "queue_activity", "unqueue_activity", "move_in_queue", "reorder_queue",
  "reschedule_activity", "add_reminder", "dismiss_reminder", "add_subtask",
  "create_activity_type", "undo_last_action", "purge_deleted_activities",
]);

function titleGuess(request: string) {
  const m =
    request.match(/cria(?:r)?(?: uma)? tarefa(?: de)?\s+(.+)/i)
    || request.match(/registra(?:r)? que preciso\s+(.+)/i)
    || request.match(/anota(?:r)?\s+(.+)/i);
  return m?.[1]?.trim().replace(/\.$/, "") || undefined;
}

function queryGuess(request: string) {
  const m =
    request.match(/(?:tarefa|atividade)\s+(?:do|da|de|x)\s*(.+)$/i)
    || request.match(/(?:conclui|apaga|inicia|pausa|reabre|edita)\s+(?:a\s+)?(?:tarefa\s+)?(.+)/i);
  return m?.[1]?.replace(/^a tarefa\s+/i, "").trim() || undefined;
}

function listArgs(request: string) {
  const n = normalize(request);
  const args: Record<string, unknown> = { status: "open", sort: "score", limit: 15 };
  if (/\batrasad/.test(n)) args.due = "overdue";
  else if (/\bhoje\b/.test(n)) args.due = "today";
  else if (/\bsemana\b/.test(n)) args.due = "this_week";
  if (/\bfila\b/.test(n)) args.in_queue = true;
  return args;
}

export async function buildSuggestedTools(opts: {
  intent: CortexIntent | null;
  request: string;
  allowedTools?: string[];
  scopes: string[];
}): Promise<{ tools: SuggestedTool[]; missing_scope: string[] }> {
  const missing_scope: string[] = [];
  const names = (opts.intent?.tools?.length ? opts.intent.tools : []).filter((name) => {
    if (opts.allowedTools?.length && !opts.allowedTools.includes(name)) return false;
    return true;
  });
  const tools: SuggestedTool[] = [];

  for (const name of names) {
    const needsWrite = WRITE_TOOLS.has(name);
    const need: McpScope = name === "purge_deleted_activities" ? "admin" : needsWrite ? "write" : "read";
    if (!hasScope(opts.scopes, need)) {
      missing_scope.push(name);
      continue;
    }
    const destructive = DESTRUCTIVE.has(name) || Boolean(opts.intent?.destructive);
    let args: Record<string, unknown> = {};
    let why = `Intent ${opts.intent?.key ?? "geral"}`;
    let requires_confirmation = destructive;
    let candidates: { id: string; title: string }[] | undefined;

    if (name === "list_activities") {
      args = listArgs(opts.request);
      why = "Listar dados vivos de tarefas (não é a base de conhecimento).";
    } else if (name === "get_daily_briefing" || name === "plan_day" || name === "get_weekly_review") {
      args = {};
      why = "Resumo vivo do dia/semana.";
    } else if (name === "create_activity") {
      const title = titleGuess(opts.request);
      args = title ? { title } : {};
      why = "Criar tarefa a partir do pedido.";
    } else if (name === "search_knowledge") {
      args = { query: opts.request };
      why = "Buscar método na base (não usa para achar tarefa).";
    } else if (
      name === "complete_activity"
      || name === "delete_activity"
      || name === "start_activity"
      || name === "pause_activity"
      || name === "reopen_activity"
      || name === "restore_activity"
      || name === "get_activity"
      || name === "update_activity"
      || name === "reschedule_activity"
    ) {
      const query = queryGuess(opts.request);
      args = query ? { query } : {};
      why = `Operar a tarefa citada (${query || "informe o título"}).`;
      if (query && name !== "get_activity") {
        try {
          const row = await resolveActivity({ query });
          args = { id: row.id };
          if (name === "delete_activity") {
            args.confirm = true;
            requires_confirmation = true;
          }
        } catch (err) {
          if (err instanceof ActivityAmbiguousError) {
            candidates = err.candidates;
            requires_confirmation = true;
            args = { query };
          }
        }
      }
      if (name === "delete_activity") requires_confirmation = true;
    }

    tools.push({ tool: name, args, why, requires_confirmation, ...(candidates ? { candidates } : {}) });
  }

  return { tools, missing_scope };
}
