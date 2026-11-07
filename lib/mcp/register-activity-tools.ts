import { z } from "zod";
import {
  ActivityAmbiguousError,
  ActivityNotFoundError,
  addReminder,
  addSubtask,
  completeActivity,
  createActivitiesBulk,
  createActivity,
  createType,
  dismissReminder,
  getActivity,
  getHistory,
  getQueue,
  listActivities,
  listStatuses,
  listTypes,
  pauseActivity,
  purgeDeleted,
  queueAdd,
  queueMove,
  queueRemove,
  queueReorder,
  reopenActivity,
  rescheduleActivity,
  resolveActivity,
  restoreActivity,
  setActivityStatus,
  softDelete,
  startActivity,
  undoLastAction,
  updateActivity,
} from "@/lib/activities/service";
import { getDailyBriefing, getWeeklyReview, planDay } from "@/lib/briefing/briefing";
import { parseDatePhrase } from "@/lib/activities/dates";
import { hasScope, type McpScope } from "@/lib/mcp/tokens";

type ToolServer = {
  registerTool: (
    name: string,
    config: { title?: string; description: string; inputSchema: unknown },
    handler: (args: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[] }>
  ) => void;
  registerPrompt?: (
    name: string,
    config: { title?: string; description: string; argsSchema?: unknown },
    handler: (args: Record<string, unknown>) => Promise<{ messages: unknown[] }>
  ) => void;
};

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function assertScope(scopes: string[], needed: McpScope | McpScope[]) {
  if (!hasScope(scopes, needed)) throw new Error("Token sem permissão para esta tool");
}

function actorOf(ctx: { profileId: string }, source?: unknown) {
  const src = typeof source === "string" && source === "voz" ? "voz" : "mcp";
  return { actorId: ctx.profileId || null, source: src };
}

async function target(args: Record<string, unknown>, includeDeleted = false) {
  try {
    return await resolveActivity({
      id: args.id ? String(args.id) : args.activity_id ? String(args.activity_id) : undefined,
      query: args.query ? String(args.query) : undefined,
      includeDeleted,
    });
  } catch (err) {
    if (err instanceof ActivityAmbiguousError) {
      return { ambiguous: true, candidates: err.candidates, message: err.message };
    }
    throw err;
  }
}

const idOrQuery = {
  id: z.string().optional(),
  query: z.string().optional(),
};

export function registerActivityTools(
  server: ToolServer,
  ctx: { tokenId: string; profileId: string; scopes: string[] }
) {
  const wrap = async (fn: () => Promise<unknown>) => {
    try {
      return text(await fn());
    } catch (err) {
      if (err instanceof ActivityNotFoundError || err instanceof ActivityAmbiguousError) {
        if (err instanceof ActivityAmbiguousError) return text({ candidates: err.candidates, message: err.message });
        return text({ error: err.message });
      }
      if (err instanceof Error) return text({ error: err.message });
      throw err;
    }
  };

  server.registerTool("list_activities", {
    description: "Lista tarefas. Filtros: status (key|open|done|all), priority, due (overdue|today|tomorrow|this_week|next_7d|no_date), type, tags, area, q, in_queue, include_deleted, sort (score|due|created|queue)",
    inputSchema: z.object({
      status: z.string().optional(),
      priority: z.string().optional(),
      due: z.string().optional(),
      type: z.string().optional(),
      tags: z.array(z.string()).optional(),
      area: z.string().optional(),
      q: z.string().optional(),
      in_queue: z.boolean().optional(),
      include_deleted: z.boolean().optional(),
      sort: z.string().optional(),
      limit: z.number().optional(),
    }),
  }, async (args) => {
    assertScope(ctx.scopes, "read");
    return wrap(() => listActivities({
      status: args.status ? String(args.status) : undefined,
      priority: args.priority ? String(args.priority) : undefined,
      due: args.due ? String(args.due) : undefined,
      type: args.type ? String(args.type) : undefined,
      tags: Array.isArray(args.tags) ? args.tags.map(String) : undefined,
      area: args.area ? String(args.area) : undefined,
      q: args.q ? String(args.q) : undefined,
      in_queue: Boolean(args.in_queue),
      include_deleted: Boolean(args.include_deleted),
      sort: args.sort ? String(args.sort) : "score",
      limit: typeof args.limit === "number" ? args.limit : 20,
    }));
  });

  server.registerTool("get_activity", {
    description: "Detalhe da tarefa (id ou query), subtarefas, histórico, sessões e lembretes",
    inputSchema: z.object(idOrQuery),
  }, async (args) => {
    assertScope(ctx.scopes, "read");
    return wrap(() => getActivity({ id: args.id ? String(args.id) : undefined, query: args.query ? String(args.query) : undefined }));
  });

  server.registerTool("search_activities", {
    description: "Busca textual por título/descrição/notas (ex.: 'proposta Vero')",
    inputSchema: z.object({ q: z.string(), limit: z.number().optional() }),
  }, async (args) => {
    assertScope(ctx.scopes, "read");
    return wrap(() => listActivities({ q: String(args.q), limit: typeof args.limit === "number" ? args.limit : 10, sort: "score" }));
  });

  server.registerTool("get_queue", {
    description: "Fila de execução em ordem",
    inputSchema: z.object({}),
  }, async () => {
    assertScope(ctx.scopes, "read");
    return wrap(() => getQueue());
  });

  server.registerTool("list_activity_statuses", {
    description: "Status configuráveis das tarefas",
    inputSchema: z.object({}),
  }, async () => {
    assertScope(ctx.scopes, "read");
    return wrap(() => listStatuses());
  });

  server.registerTool("list_activity_types", {
    description: "Tipos configuráveis das tarefas",
    inputSchema: z.object({}),
  }, async () => {
    assertScope(ctx.scopes, "read");
    return wrap(() => listTypes());
  });

  server.registerTool("get_daily_briefing", {
    description: "Cérebro do dia: top 3, atrasadas, vencendo, lembretes, carga vs agenda (busy_blocks) e alertas. Score determinístico.",
    inputSchema: z.object({
      date: z.string().optional(),
      busy_blocks: z.array(z.object({ start: z.string(), end: z.string(), title: z.string().optional() })).optional(),
    }),
  }, async (args) => {
    assertScope(ctx.scopes, "read");
    const d = args.date ? parseDatePhrase(String(args.date))?.date : undefined;
    const busy = Array.isArray(args.busy_blocks) ? args.busy_blocks as { start: string; end: string; title?: string }[] : [];
    return wrap(() => getDailyBriefing(d, busy));
  });

  server.registerTool("get_weekly_review", {
    description: "Revisão da semana: criadas, concluídas, atrasadas, tempo por área, paradas",
    inputSchema: z.object({ week_start: z.string().optional() }),
  }, async (args) => {
    assertScope(ctx.scopes, "read");
    const d = args.week_start ? parseDatePhrase(String(args.week_start))?.date : undefined;
    return wrap(() => getWeeklyReview(d));
  });

  server.registerTool("plan_day", {
    description: "Encaixa tarefas nos horários livres (busy_blocks da agenda). Não grava sem apply=true (exige write).",
    inputSchema: z.object({
      date: z.string().optional(),
      busy_blocks: z.array(z.object({ start: z.string(), end: z.string(), title: z.string().optional() })).optional(),
      strategy: z.string().optional(),
      apply: z.boolean().optional(),
    }),
  }, async (args) => {
    const apply = Boolean(args.apply);
    assertScope(ctx.scopes, apply ? "write" : "read");
    const d = args.date ? parseDatePhrase(String(args.date))?.date : undefined;
    const busy = Array.isArray(args.busy_blocks) ? args.busy_blocks as { start: string; end: string }[] : [];
    return wrap(() => planDay({ date: d, busyBlocks: busy, strategy: args.strategy ? String(args.strategy) : undefined, apply, actor: actorOf(ctx) }));
  });

  server.registerTool("get_activity_history", {
    description: "Eventos de uma tarefa ou do dia",
    inputSchema: z.object({ id: z.string().optional(), date: z.string().optional() }),
  }, async (args) => {
    assertScope(ctx.scopes, "read");
    return wrap(() => getHistory({ id: args.id ? String(args.id) : undefined, date: args.date ? String(args.date) : undefined }));
  });

  const createShape = z.object({
    title: z.string(),
    type: z.string().optional(),
    type_id: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    due: z.string().optional(),
    due_date: z.string().optional(),
    notes: z.string().optional(),
    description: z.string().optional(),
    estimated_minutes: z.number().optional(),
    importance: z.number().optional(),
    urgency: z.number().optional(),
    energy: z.string().optional(),
    context: z.string().optional(),
    tags: z.array(z.string()).optional(),
    area: z.string().optional(),
    waiting_on: z.string().optional(),
    parent_id: z.string().optional(),
    recurrence: z.string().optional(),
    client_key: z.string().optional(),
    add_to_queue: z.union([z.boolean(), z.number()]).optional(),
    source: z.string().optional(),
  });

  function fromCreate(args: Record<string, unknown>) {
    return {
      title: String(args.title || ""),
      type: args.type ? String(args.type) : undefined,
      typeId: args.type_id ? String(args.type_id) : undefined,
      status: args.status ? String(args.status) : undefined,
      priority: args.priority ? String(args.priority) : undefined,
      dueDate: (args.due || args.due_date) ? String(args.due || args.due_date) : undefined,
      notes: args.notes ? String(args.notes) : undefined,
      description: args.description ? String(args.description) : undefined,
      estimatedMinutes: typeof args.estimated_minutes === "number" ? args.estimated_minutes : undefined,
      importance: typeof args.importance === "number" ? args.importance : undefined,
      urgency: typeof args.urgency === "number" ? args.urgency : undefined,
      energy: args.energy ? String(args.energy) : undefined,
      context: args.context ? String(args.context) : undefined,
      tags: Array.isArray(args.tags) ? args.tags.map(String) : undefined,
      area: args.area ? String(args.area) : undefined,
      waitingOn: args.waiting_on ? String(args.waiting_on) : undefined,
      parentId: args.parent_id ? String(args.parent_id) : undefined,
      recurrenceRule: args.recurrence ? String(args.recurrence) : undefined,
      clientKey: args.client_key ? String(args.client_key) : undefined,
      addToQueue: args.add_to_queue as boolean | number | undefined,
      source: args.source ? String(args.source) : undefined,
    };
  }

  server.registerTool("create_activity", {
    description: "Cria uma tarefa. Datas em PT-BR ('hoje','sexta','dia 15'). client_key evita duplicar ditado. add_to_queue opcional.",
    inputSchema: createShape,
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    return wrap(async () => {
      const created = await createActivity(fromCreate(args), actorOf(ctx, args.source));
      return { ...created.presented, idempotent: created.idempotent, interpreted_as: created.interpreted_as, voice: created.presented.voice };
    });
  });

  server.registerTool("create_activities_bulk", {
    description: "Cria até 30 tarefas de uma vez (despejo por voz). Cada item igual a create_activity.",
    inputSchema: z.object({ items: z.array(createShape) }),
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    const items = Array.isArray(args.items) ? args.items as Record<string, unknown>[] : [];
    return wrap(async () => {
      const created = await createActivitiesBulk(items.map(fromCreate), actorOf(ctx, args.source));
      return created.map((c) => ({ ...c.presented, idempotent: c.idempotent }));
    });
  });

  server.registerTool("update_activity", {
    description: "Edita campos da tarefa (id ou query)",
    inputSchema: createShape.extend(idOrQuery).partial().extend({ id: z.string().optional(), query: z.string().optional() }),
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    return wrap(async () => {
      const hit = await target(args);
      if (hit && "ambiguous" in hit) return hit;
      const row = hit as { id: string };
      const patch = fromCreate(args);
      if (!args.title) delete (patch as { title?: string }).title;
      const updated = await updateActivity(row.id, patch, actorOf(ctx, args.source));
      return updated.presented;
    });
  });

  const act = (name: string, description: string, fn: (id: string, args: Record<string, unknown>) => Promise<unknown>, extra: Record<string, z.ZodType> = {}) => {
    server.registerTool(name, {
      description,
      inputSchema: z.object({ ...idOrQuery, ...extra }),
    }, async (args) => {
      assertScope(ctx.scopes, "write");
      return wrap(async () => {
        const hit = await target(args, name === "restore_activity");
        if (hit && "ambiguous" in hit) return hit;
        return fn((hit as { id: string }).id, args);
      });
    });
  };

  act("start_activity", "Inicia a tarefa (em andamento + cronômetro). Pausa outra sessão aberta.", async (id) => (await startActivity(id, actorOf(ctx))).presented);
  act("pause_activity", "Pausa o cronômetro, mantém em andamento", async (id) => (await pauseActivity(id, actorOf(ctx))).presented);
  act("complete_activity", "Conclui, sai da fila, gera próxima se recorrente", async (id) => (await completeActivity(id, actorOf(ctx))).presented);
  act("reopen_activity", "Reabre para pendente", async (id) => (await reopenActivity(id, actorOf(ctx))).presented);
  act("set_activity_status", "Muda status por key", async (id, args) => (await setActivityStatus(id, String(args.status), actorOf(ctx))).presented, { status: z.string() });
  act("delete_activity", "Lixeira (soft delete). Exige confirm=true.", async (id, args) => (await softDelete(id, actorOf(ctx), args.confirm === true)).presented, { confirm: z.boolean().optional() });
  act("restore_activity", "Tira da lixeira", async (id) => (await restoreActivity(id, actorOf(ctx))).presented);
  act("queue_activity", "Coloca na fila", async (id, args) => queueAdd([id], typeof args.position === "number" ? args.position : undefined, actorOf(ctx)), { position: z.number().optional() });
  act("unqueue_activity", "Tira da fila", async (id) => queueRemove(id, actorOf(ctx)));
  act("move_in_queue", "Move para a posição (1 = topo)", async (id, args) => queueMove(id, Number(args.position || 1), actorOf(ctx)), { position: z.number() });
  act("reschedule_activity", "Muda prazo e/ou bloco de tempo", async (id, args) => (await rescheduleActivity(id, {
    dueDate: args.due ? String(args.due) : args.due_date ? String(args.due_date) : undefined,
    scheduledStart: args.scheduled_start ? String(args.scheduled_start) : undefined,
    scheduledEnd: args.scheduled_end ? String(args.scheduled_end) : undefined,
  }, actorOf(ctx))).presented, {
    due: z.string().optional(),
    due_date: z.string().optional(),
    scheduled_start: z.string().optional(),
    scheduled_end: z.string().optional(),
  });
  act("add_reminder", "Cria lembrete (aparece no briefing)", async (id, args) => addReminder(id, String(args.remind_at), args.message ? String(args.message) : "", actorOf(ctx)), {
    remind_at: z.string(),
    message: z.string().optional(),
  });
  act("add_subtask", "Cria subtarefa", async (id, args) => (await addSubtask(id, String(args.title), actorOf(ctx))).presented, { title: z.string() });

  server.registerTool("reorder_queue", {
    description: "Reordena a fila inteira pelos ids",
    inputSchema: z.object({ ordered_ids: z.array(z.string()) }),
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    const ids = Array.isArray(args.ordered_ids) ? args.ordered_ids.map(String) : [];
    return wrap(() => queueReorder(ids, actorOf(ctx)));
  });

  server.registerTool("dismiss_reminder", {
    description: "Dispensa um lembrete",
    inputSchema: z.object({ reminder_id: z.string() }),
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    return wrap(() => dismissReminder(String(args.reminder_id), actorOf(ctx)));
  });

  server.registerTool("create_activity_type", {
    description: "Cria tipo de atividade",
    inputSchema: z.object({ name: z.string(), color: z.string().optional() }),
  }, async (args) => {
    assertScope(ctx.scopes, "write");
    return wrap(() => createType(String(args.name), args.color ? String(args.color) : undefined, actorOf(ctx)));
  });

  server.registerTool("undo_last_action", {
    description: "Desfaz a última escrita deste usuário (até 30 min)",
    inputSchema: z.object({}),
  }, async () => {
    assertScope(ctx.scopes, "write");
    return wrap(() => undoLastAction(actorOf(ctx)));
  });

  server.registerTool("purge_deleted_activities", {
    description: "Apaga de vez tarefas da lixeira (admin). Sem ids, purga toda a lixeira.",
    inputSchema: z.object({ ids: z.array(z.string()).optional() }),
  }, async (args) => {
    assertScope(ctx.scopes, "admin");
    const ids = Array.isArray(args.ids) ? args.ids.map(String) : undefined;
    return wrap(() => purgeDeleted(ids, actorOf(ctx)));
  });

  server.registerPrompt?.("briefing_do_dia", {
    title: "Briefing do dia",
    description: "Como pedir o briefing: chame get_daily_briefing (com busy_blocks se houver agenda) e fale no formato voz.",
  }, async () => ({
    messages: [{ role: "user", content: { type: "text", text: "Chame get_daily_briefing. Fale: 1 frase, top 3, alertas críticos, primeiro passo. Máx 120 palavras." } }],
  }));

  server.registerPrompt?.("capturar_tarefas", {
    title: "Capturar tarefas por voz",
    description: "Guia de captura: criar primeiro, client_key, no máximo 1 pergunta.",
  }, async () => ({
    messages: [{ role: "user", content: { type: "text", text: "Crie a tarefa já com verbo + prazo ou 'sem prazo'. Use client_key. Só 1 pergunta extra. Confirme curto." } }],
  }));
}
