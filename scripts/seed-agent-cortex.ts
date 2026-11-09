/**
 * Seed idempotente do Cortex (orquestrador). Reaproveita o agente já existente.
 * 4 camadas, 2 docs gerados, routing de gestao-tempo / migracao-aws / demais.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { ORCHESTRATOR_ID, ROOM_FOLDERS, roomName } from "../lib/agents";
import { ensureOrchestrator } from "../lib/agents-db";
import { upsertFileContent } from "../lib/knowledge/files";
import { publishPrompt } from "../lib/agents/prompt-composer";
import { LAYER_LABELS, type PromptLayer } from "../lib/knowledge/kinds";
import {
  CORTEX_ROUTING,
  GESTAO_TEMPO_ROUTING,
  MIGRACAO_AWS_ROUTING,
  PROPOSTAS_ROUTING,
  minimalRouting,
} from "../lib/cortex/default-routing";
import { asAgentRouting } from "../lib/cortex/routing-schema";

const SLUG = "cortex";
const NAME = "Cortex";

const LAYERS: { layer: PromptLayer; title: string; markdown: string }[] = [
  {
    layer: "identidade",
    title: "Identidade",
    markdown: `# Identidade

Você é o Cortex, chefe do escritório JayP. Conhece todos os agentes. Fala curto e direto, pronto para voz.

O cliente (Quick/ChatGPT) é quem pensa. Você é prompt + mapa: aponta o agente certo, os dados vivos e as tools. Não inventa tarefa, prazo ou evento.
`,
  },
  {
    layer: "roteamento",
    title: "Roteamento",
    markdown: `# Roteamento

Esta camada é preenchida no seed com a tabela real agente → domínios → exemplos (ver documento Mapa do escritório).

Regra: pedidos de tarefa/agenda/prioridade → Gestor de Atividades (\`gestao-tempo\`) com tools de atividade. Pedidos de MAP/AWS/funding → Agente de Migração (\`migracao-aws\`) com a base. Nunca busque tarefa em search_knowledge.
`,
  },
  {
    layer: "regras",
    title: "Regras",
    markdown: `# Regras

- Sempre um agente responsável.
- Dados vivos (Atividades) > base de conhecimento (método).
- Nunca inventar tarefa, evento ou número.
- Ação destrutiva (apagar, purgar, conclusão em massa) só depois de confirmar.
- Se o pedido for ambíguo, perguntar com 2–3 opções.
- Chamar a tool \`cortex\` primeiro; em seguida executar \`suggested_tools\`.
`,
  },
  {
    layer: "formato_saida",
    title: "Formato",
    markdown: `# Formato

1. (Opcional) 1 linha: quem atendeu.
2. Resposta.
3. Próximo passo.

Máximo curto, pronto para voz.
`,
  },
];

async function ensureFolder(workspaceId: string, name: string, order: number) {
  const existing = await prisma.workspaceFolder.findFirst({ where: { workspaceId, name } });
  if (existing) return existing;
  return prisma.workspaceFolder.create({ data: { workspaceId, name, order } });
}

async function upsertNamedFile(opts: {
  workspaceId: string;
  folderId: string;
  title: string;
  kind: string;
  tags: string[];
  markdown: string;
}) {
  const existing = await prisma.workspaceFile.findFirst({
    where: { workspaceId: opts.workspaceId, title: opts.title },
    select: { id: true },
  });
  return upsertFileContent({
    fileId: existing?.id,
    workspaceId: opts.workspaceId,
    folderId: opts.folderId,
    title: opts.title,
    content: opts.markdown,
    kind: opts.kind,
    tags: opts.tags,
    source: "seed",
  });
}

function routingTableMarkdown(agents: { name: string; slug: string | null; role: string; routing: unknown }[]) {
  const lines = [
    "# Roteamento",
    "",
    "Tabela gerada do `routing` real dos agentes.",
    "",
    "| Agente | Slug | Domínios | Exemplos |",
    "|---|---|---|---|",
  ];
  for (const agent of agents) {
    const routing = asAgentRouting(agent.routing);
    const domains = (routing.domains ?? []).join(", ") || agent.role || "—";
    const examples = (routing.intents ?? []).flatMap((i) => i.examples ?? []).slice(0, 4).join("; ") || "—";
    lines.push(`| ${agent.name} | \`${agent.slug || "—"}\` | ${domains} | ${examples} |`);
  }
  return lines.join("\n");
}

async function officeMapMarkdown() {
  const agents = await prisma.agent.findMany({
    orderBy: [{ isOrchestrator: "desc" }, { name: "asc" }],
    select: { name: true, slug: true, role: true, routing: true },
  });
  const lines = [
    "# Mapa do escritório",
    "",
    `Gerado do banco em ${new Date().toISOString().slice(0, 10)}.`,
    "",
    "## Agentes",
    "",
  ];
  for (const agent of agents) {
    const routing = asAgentRouting(agent.routing);
    lines.push(`### ${agent.name} (\`${agent.slug || "sem-slug"}\`)`);
    lines.push(`Papel: ${agent.role || "—"}.`);
    lines.push(`Domínios: ${(routing.domains ?? []).join(", ") || "—"}.`);
    lines.push(`Tools: ${(routing.allowed_tools ?? []).join(", ") || "leitura da base"}.`);
    lines.push("");
  }
  lines.push("## Como o cliente deve pedir");
  lines.push("Chame a tool `cortex` com o pedido em português. Tarefas ≠ base de conhecimento.");
  return lines.join("\n");
}

function howToMarkdown() {
  return `# Como usar o Cortex

Fluxo do prompt MCP \`cortex_start\`:

1. Chame \`cortex\` com o pedido (e \`busy_blocks\` se tiver agenda).
2. Responda vestindo \`agent_prompt\`.
3. Execute \`suggested_tools\` em ordem.
4. Confirme com o usuário as que tiverem \`requires_confirmation\`.
5. Resposta curta, pronta para voz.

Não use \`search_knowledge\` / \`read_document\` para listar ou achar tarefas. Isso é \`list_activities\` / \`search_activities\`.
`;
}

async function main() {
  await ensureOrchestrator();

  const agent = await prisma.agent.findFirst({
    where: { OR: [{ id: ORCHESTRATOR_ID }, { slug: SLUG }, { isOrchestrator: true }] },
    include: { workspace: { include: { folders: true } } },
  });
  if (!agent) throw new Error("Orquestrador não encontrado");

  await prisma.agent.update({
    where: { id: agent.id },
    data: {
      name: NAME,
      slug: SLUG,
      role: "Orquestrador do escritório",
      description:
        "Porta de entrada do escritório: roteia o pedido ao agente certo e empacota prompt, conhecimento e dados vivos.",
      status: "active",
      isOrchestrator: true,
      routing: CORTEX_ROUTING as object,
    },
  });
  if (agent.workspaceId) {
    await prisma.workspace.update({
      where: { id: agent.workspaceId },
      data: { name: roomName(NAME), description: "Sala do Cortex: mapa do escritório e regras de roteamento." },
    });
  }
  if (!agent.workspaceId) throw new Error("Cortex sem sala");
  const workspaceId = agent.workspaceId;

  const folders: Record<string, string> = {};
  for (const [order, name] of ROOM_FOLDERS.entries()) {
    const folder = await ensureFolder(workspaceId, name, order);
    folders[name] = folder.id;
  }

  const others = await prisma.agent.findMany({
    where: { id: { not: agent.id } },
    select: { id: true, slug: true, role: true, description: true, routing: true },
  });
  for (const other of others) {
    const current = asAgentRouting(other.routing);
    const hasIntents = (current.intents ?? []).length > 0;
    let routing = current;
    if (other.slug === "gestao-tempo") routing = GESTAO_TEMPO_ROUTING;
    else if (other.slug === "migracao-aws") routing = MIGRACAO_AWS_ROUTING;
    else if (other.slug === "propostas") routing = PROPOSTAS_ROUTING;
    else if (!hasIntents && !(current.keywords ?? []).length) {
      routing = minimalRouting(other.role, other.description);
    }
    await prisma.agent.update({
      where: { id: other.id },
      data: { routing: routing as object },
    });
  }

  const routingLayer = routingTableMarkdown(
    await prisma.agent.findMany({
      orderBy: [{ isOrchestrator: "desc" }, { name: "asc" }],
      select: { name: true, slug: true, role: true, routing: true },
    })
  );
  const layers = LAYERS.map((layer) =>
    layer.layer === "roteamento" ? { ...layer, markdown: routingLayer } : layer
  );

  for (const [order, layer] of layers.entries()) {
    const saved = await upsertNamedFile({
      workspaceId,
      folderId: folders.Prompt,
      title: layer.title,
      kind: "prompt",
      tags: ["prompt", layer.layer],
      markdown: layer.markdown,
    });
    const fileId = saved.file?.id;
    if (!fileId) throw new Error(`Falha ao gravar camada ${layer.layer}`);
    await prisma.agentPromptLayer.upsert({
      where: { agentId_layer: { agentId: agent.id, layer: layer.layer } },
      create: { agentId: agent.id, fileId, layer: layer.layer, order, enabled: true },
      update: { fileId, order, enabled: true },
    });
    console.log("camada", LAYER_LABELS[layer.layer] ?? layer.layer);
  }

  const docs = [
    {
      title: "Mapa do escritório",
      kind: "referencia",
      tags: ["mapa", "agentes"],
      markdown: await officeMapMarkdown(),
    },
    {
      title: "Como usar o Cortex",
      kind: "processo",
      tags: ["cortex", "mcp"],
      markdown: howToMarkdown(),
    },
  ];
  for (const doc of docs) {
    const saved = await upsertNamedFile({
      workspaceId,
      folderId: folders["Base de conhecimento"],
      title: doc.title,
      kind: doc.kind,
      tags: doc.tags,
      markdown: doc.markdown,
    });
    const fileId = saved.file?.id;
    if (!fileId) throw new Error(`Falha ao gravar ${doc.title}`);
    await prisma.agentKnowledge.upsert({
      where: { agentId_fileId: { agentId: agent.id, fileId } },
      create: { agentId: agent.id, fileId },
      update: {},
    });
    console.log(doc.kind, saved.index?.status, doc.title);
  }

  const published = await publishPrompt({
    agentId: agent.id,
    note: "v1 Cortex orquestrador (roteador + contexto)",
    source: "seed",
  });
  console.log("prompt publicado", published.version, published.id);

  console.log(JSON.stringify({
    slug: SLUG,
    agentId: agent.id,
    workspaceId,
    layers: await prisma.agentPromptLayer.count({ where: { agentId: agent.id } }),
    knowledge: await prisma.agentKnowledge.count({ where: { agentId: agent.id } }),
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
