import assert from "node:assert/strict";
import { test } from "node:test";
import { normalize } from "./normalize";
import { routeFromAgents } from "./router";
import { CORTEX_ROUTING, GESTAO_TEMPO_ROUTING, MIGRACAO_AWS_ROUTING } from "./default-routing";
import type { RouteAgent } from "./types";

const agents: RouteAgent[] = [
  { slug: "cortex", name: "Cortex", isOrchestrator: true, status: "active", routing: CORTEX_ROUTING },
  { slug: "gestao-tempo", name: "Gestor de Atividades", status: "active", routing: GESTAO_TEMPO_ROUTING },
  { slug: "migracao-aws", name: "Agente de Migração AWS", status: "active", routing: MIGRACAO_AWS_ROUTING },
  {
    slug: "financeiro",
    name: "Financeiro",
    status: "active",
    routing: { keywords: ["nota fiscal", "boleto", "imposto"], default_mode: "conhecimento", intents: [] },
  },
];

function route(request: string, hint?: string) {
  return routeFromAgents(request, agents, { agentHint: hint });
}

test("normalize sinônimos PT", () => {
  assert.equal(normalize("Lista minhas TAREFAS"), "lista minhas atividade");
  assert.ok(normalize("calendário").includes("agenda"));
  assert.ok(normalize("migração AWS").includes("map"));
});

const cases: { q: string; slug: string; mode: string; intent?: string }[] = [
  { q: "lista minhas tarefas de hoje", slug: "gestao-tempo", mode: "acao", intent: "listar_atividades" },
  { q: "lista minhas atividades", slug: "gestao-tempo", mode: "acao", intent: "listar_atividades" },
  { q: "o que tenho pra hoje?", slug: "gestao-tempo", mode: "acao", intent: "listar_atividades" },
  { q: "o que eu priorizo hoje?", slug: "gestao-tempo", mode: "acao", intent: "briefing" },
  { q: "briefing do dia", slug: "gestao-tempo", mode: "acao", intent: "briefing" },
  { q: "cria tarefa enviar proposta Vero sexta", slug: "gestao-tempo", mode: "acao", intent: "criar_atividade" },
  { q: "registra que preciso ligar pro cliente", slug: "gestao-tempo", mode: "acao", intent: "criar_atividade" },
  { q: "conclui a tarefa do kickoff", slug: "gestao-tempo", mode: "acao", intent: "concluir_atividade" },
  { q: "apaga a tarefa X", slug: "gestao-tempo", mode: "acao", intent: "apagar_atividade" },
  { q: "mostra a fila", slug: "gestao-tempo", mode: "acao", intent: "fila" },
  { q: "inicia a tarefa da proposta", slug: "gestao-tempo", mode: "acao", intent: "iniciar_atividade" },
  { q: "pausa o cronômetro", slug: "gestao-tempo", mode: "acao", intent: "pausar_atividade" },
  { q: "reagenda a tarefa pra amanhã", slug: "gestao-tempo", mode: "acao", intent: "reagendar" },
  { q: "me lembra da tarefa às 9h", slug: "gestao-tempo", mode: "acao", intent: "lembrete" },
  { q: "adiciona subtarefa revisar SO", slug: "gestao-tempo", mode: "acao", intent: "subtarefa" },
  { q: "planeja meu dia", slug: "gestao-tempo", mode: "acao", intent: "plano_do_dia" },
  { q: "revisão da semana", slug: "gestao-tempo", mode: "acao", intent: "revisao_semanal" },
  { q: "como evito procrastinar a proposta?", slug: "gestao-tempo", mode: "misto", intent: "metodo_procrastinacao" },
  { q: "restaura a tarefa da lixeira", slug: "gestao-tempo", mode: "acao", intent: "restaurar_atividade" },
  { q: "edita a prioridade da tarefa", slug: "gestao-tempo", mode: "acao", intent: "editar_atividade" },
  { q: "como funciona o funding do MAP?", slug: "migracao-aws", mode: "conhecimento", intent: "funding" },
  { q: "fases do MAP", slug: "migracao-aws", mode: "conhecimento", intent: "fases_map" },
  { q: "o que é um assess?", slug: "migracao-aws", mode: "conhecimento", intent: "assess" },
  { q: "template de proposta de migração", slug: "migracao-aws", mode: "conhecimento", intent: "proposta_map" },
  { q: "explica o MAP", slug: "migracao-aws", mode: "conhecimento", intent: "visao_map" },
  { q: "quanto tempo um assess toma da minha semana?", slug: "gestao-tempo", mode: "misto" },
];

for (const item of cases) {
  test(`rota: ${item.q}`, () => {
    const result = route(item.q);
    assert.equal(result.mode, item.mode, `${item.q} mode=${result.mode} conf=${result.confidence} ${JSON.stringify(result.candidates)}`);
    assert.equal(result.agent?.slug, item.slug, `${item.q} slug=${result.agent?.slug} conf=${result.confidence}`);
    if (item.intent) {
      assert.equal(result.intent?.key, item.intent, `${item.q} intent=${result.intent?.key}`);
    }
    assert.ok(result.confidence >= 0.5, `${item.q} confiança ${result.confidence}`);
  });
}

test("frase ambígua pede esclarecer", () => {
  const result = route("me ajuda com aquilo depois");
  assert.equal(result.mode, "esclarecer");
  assert.equal(result.agent, null);
  assert.ok(result.candidates.length >= 1);
});

test("agent_hint desempata", () => {
  const result = route("me fala do assess", "gestao-tempo");
  assert.equal(result.agent?.slug, "gestao-tempo");
});
