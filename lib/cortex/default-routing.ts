import type { AgentRouting } from "@/lib/cortex/types";

const LIVE_ACTIVITY_TOOLS = [
  "list_activities", "get_activity", "search_activities", "get_queue",
  "list_activity_statuses", "list_activity_types",
  "get_daily_briefing", "get_weekly_review", "plan_day", "apply_day_plan", "get_activity_history",
  "create_activity", "create_activities_bulk", "update_activity",
  "start_activity", "pause_activity", "complete_activity", "reopen_activity",
  "set_activity_status", "delete_activity", "restore_activity",
  "queue_activity", "unqueue_activity", "move_in_queue", "reorder_queue",
  "reschedule_activity", "add_reminder", "dismiss_reminder", "add_subtask",
  "create_activity_type", "undo_last_action", "purge_deleted_activities",
];

export const GESTAO_TEMPO_ROUTING: AgentRouting = {
  domains: ["tarefas", "agenda", "prioridade", "procrastinacao", "rotina", "tempo", "fila"],
  keywords: [
    "tarefa", "atividade", "fila", "prazo", "agenda", "prioridade", "concluir",
    "pendente", "atrasada", "briefing", "hoje", "semana", "lembrete", "cronometro",
    "procrastinacao", "rotina", "bloco", "foco",
  ],
  knowledge_kinds: ["metodologia", "processo", "referencia"],
  allowed_tools: LIVE_ACTIVITY_TOOLS,
  default_mode: "misto",
  intents: [
    {
      key: "listar_atividades",
      mode: "acao",
      tools: ["list_activities", "get_daily_briefing"],
      examples: [
        "lista minhas tarefas",
        "lista minhas atividades",
        "o que tenho pra hoje",
        "quais tarefas estao abertas",
        "mostra minhas pendencias",
        "o que esta atrasado",
        "tarefas da semana",
        "lista a fila",
      ],
    },
    {
      key: "buscar_atividade",
      mode: "acao",
      tools: ["search_activities", "get_activity"],
      examples: [
        "busca a tarefa",
        "acha a proposta vero",
        "onde esta a tarefa do kickoff",
        "abre a atividade",
      ],
    },
    {
      key: "criar_atividade",
      mode: "acao",
      tools: ["create_activity"],
      examples: [
        "cria uma tarefa",
        "cria tarefa enviar proposta",
        "registra que preciso",
        "anota uma atividade",
        "nova tarefa",
        "me lembra de fazer",
      ],
    },
    {
      key: "criar_em_lote",
      mode: "acao",
      tools: ["create_activities_bulk"],
      examples: [
        "cria varias tarefas",
        "despeja essas atividades",
        "captura essa lista de tarefas",
      ],
    },
    {
      key: "editar_atividade",
      mode: "acao",
      tools: ["update_activity"],
      examples: ["edita a tarefa", "muda a prioridade", "atualiza a atividade", "renomeia a tarefa"],
    },
    {
      key: "iniciar_atividade",
      mode: "acao",
      tools: ["start_activity"],
      examples: ["inicia a tarefa", "comeca a trabalhar nisso", "start na atividade", "liga o cronometro"],
    },
    {
      key: "pausar_atividade",
      mode: "acao",
      tools: ["pause_activity"],
      examples: ["pausa a tarefa", "pausa o cronometro", "interrompe a atividade"],
    },
    {
      key: "concluir_atividade",
      mode: "acao",
      tools: ["complete_activity"],
      examples: [
        "conclui a tarefa",
        "conclui a tarefa do kickoff",
        "marca como feita",
        "finalizei a atividade",
        "completei a proposta",
      ],
    },
    {
      key: "reabrir_atividade",
      mode: "acao",
      tools: ["reopen_activity"],
      examples: ["reabre a tarefa", "volta a tarefa pra pendente"],
    },
    {
      key: "apagar_atividade",
      mode: "acao",
      tools: ["delete_activity"],
      destructive: true,
      examples: ["apaga a tarefa", "exclui a atividade", "manda a tarefa pra lixeira", "apaga a tarefa x"],
    },
    {
      key: "restaurar_atividade",
      mode: "acao",
      tools: ["restore_activity"],
      examples: ["restaura a tarefa", "tira da lixeira"],
    },
    {
      key: "fila",
      mode: "acao",
      tools: ["get_queue", "queue_activity", "unqueue_activity", "move_in_queue"],
      examples: ["mostra a fila", "poe na fila", "tira da fila", "sobe na fila", "qual e a proxima da fila"],
    },
    {
      key: "reagendar",
      mode: "acao",
      tools: ["reschedule_activity"],
      examples: ["reagenda a tarefa", "muda o prazo", "adía pra sexta", "coloca pra amanha"],
    },
    {
      key: "lembrete",
      mode: "acao",
      tools: ["add_reminder"],
      examples: ["me lembra da tarefa", "cria um lembrete", "avisa as 9h"],
    },
    {
      key: "subtarefa",
      mode: "acao",
      tools: ["add_subtask"],
      examples: ["adiciona subtarefa", "quebra essa tarefa"],
    },
    {
      key: "briefing",
      mode: "acao",
      tools: ["get_daily_briefing"],
      examples: [
        "briefing do dia",
        "o que eu priorizo hoje",
        "cerebro do dia",
        "me fala o top 3",
        "por onde eu comeco hoje",
      ],
    },
    {
      key: "plano_do_dia",
      mode: "acao",
      tools: ["plan_day", "apply_day_plan"],
      examples: ["planeja meu dia", "encaixa as tarefas na agenda", "monta o plano do dia"],
    },
    {
      key: "revisao_semanal",
      mode: "acao",
      tools: ["get_weekly_review"],
      examples: ["revisao da semana", "como foi minha semana", "o que concluí essa semana"],
    },
    {
      key: "metodo_procrastinacao",
      mode: "misto",
      tools: ["get_daily_briefing", "list_activities", "search_knowledge"],
      examples: [
        "como evito procrastinar",
        "como evito procrastinar a proposta",
        "estou procrastinando",
        "metodo contra procrastinacao",
      ],
    },
    {
      key: "priorizar",
      mode: "acao",
      tools: ["get_daily_briefing", "list_activities"],
      examples: ["o que e prioridade", "o que eu priorizo", "qual tarefa e mais importante"],
    },
  ],
};

export const MIGRACAO_AWS_ROUTING: AgentRouting = {
  domains: ["map", "aws", "migracao", "assess", "funding", "nuvem"],
  keywords: [
    "map", "aws", "assess", "funding", "7r", "mobilize", "migrate", "proposta",
    "tco", "onda", "workload", "landing zone",
  ],
  knowledge_kinds: ["metodologia", "processo", "template", "caso", "referencia"],
  allowed_tools: [
    "search_knowledge", "read_document", "list_documents", "get_agent_prompt",
    "list_activities", "search_activities",
  ],
  default_mode: "conhecimento",
  intents: [
    {
      key: "funding",
      mode: "conhecimento",
      tools: ["search_knowledge", "read_document"],
      examples: [
        "como funciona o funding do map",
        "funding map",
        "quem paga o assess",
        "credito aws map",
      ],
    },
    {
      key: "fases_map",
      mode: "conhecimento",
      tools: ["search_knowledge"],
      examples: ["fases do map", "assess mobilize migrate", "como e a jornada map"],
    },
    {
      key: "assess",
      mode: "conhecimento",
      tools: ["search_knowledge", "list_activities"],
      examples: ["o que e um assess", "como fazer o assess", "escopo do assess"],
    },
    {
      key: "proposta_map",
      mode: "conhecimento",
      tools: ["search_knowledge"],
      examples: ["proposta de migracao", "template de proposta map", "como montar a proposta aws"],
    },
    {
      key: "templates_map",
      mode: "conhecimento",
      tools: ["list_documents", "search_knowledge"],
      examples: ["templates do map", "modelo de so", "template nuage"],
    },
    {
      key: "casos_map",
      mode: "conhecimento",
      tools: ["search_knowledge"],
      examples: ["caso de migracao", "exemplo de map", "cliente que migrou"],
    },
    {
      key: "visao_map",
      mode: "conhecimento",
      tools: ["search_knowledge", "get_agent_prompt"],
      examples: ["explica o map", "o que e map", "migracao aws"],
    },
  ],
};

export const CORTEX_ROUTING: AgentRouting = {
  domains: ["roteamento", "escritorio", "agentes"],
  keywords: ["cortex", "orquestrador", "qual agente", "escritorio"],
  knowledge_kinds: ["processo", "referencia"],
  allowed_tools: ["list_agents", "get_agent", "get_agent_prompt", "list_agent_tools"],
  default_mode: "conhecimento",
  intents: [
    {
      key: "mapa_escritorio",
      mode: "conhecimento",
      tools: ["list_agents", "list_agent_tools"],
      examples: ["quais agentes existem", "quem cuida disso", "mapa do escritorio", "o que o cortex faz"],
    },
  ],
};

export function minimalRouting(role: string, description: string): AgentRouting {
  const blob = `${role} ${description}`.toLowerCase();
  const keywords = blob
    .split(/\W+/)
    .filter((w) => w.length >= 5)
    .slice(0, 8);
  return {
    domains: role ? [role.toLowerCase()] : [],
    keywords,
    intents: [],
    allowed_tools: [],
    default_mode: "conhecimento",
  };
}
