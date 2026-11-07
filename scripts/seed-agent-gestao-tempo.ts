/**
 * Seed idempotente do Cortex Tempo (slug gestao-tempo).
 * 7 camadas, 12 docs (9 e 12 gerados do código/banco), 5 templates, vínculos, prompt v1.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { createAgentWithRoom } from "../lib/agents-db";
import { ROOM_FOLDERS } from "../lib/agents";
import { upsertFileContent } from "../lib/knowledge/files";
import { publishPrompt } from "../lib/agents/prompt-composer";
import { LAYER_LABELS, type PromptLayer } from "../lib/knowledge/kinds";
import { ACTIVITY_TOOLS, DOCS, LAYERS } from "./data/gestao-tempo-content";

const SLUG = "gestao-tempo";

async function ensureFolder(workspaceId: string, name: string, order: number) {
  const existing = await prisma.workspaceFolder.findFirst({
    where: { workspaceId, name },
  });
  if (existing) return existing;
  return prisma.workspaceFolder.create({
    data: { workspaceId, name, order },
  });
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

function platformMapDoc() {
  return `# Como o agente usa a plataforma

Gerado a partir do código em 7 nov 2026.

## Tools de atividade
${ACTIVITY_TOOLS.map((t) => `- \`${t}\``).join("\n")}

## Score de prioridade (determinístico)
- base: urgent 40, high 30, normal 15, low 5
- + importance×5 + urgency×5
- prazo: atrasada +30; hoje +25; amanhã +15; semana +8
- fila: +(10 − posição)
- em andamento +10; aguardando −15
- devolve \`score\` + \`reasons[]\`

## Alertas do briefing
atrasadas · sobrecarga · urgente sem prazo · em andamento > 3 dias · fila > 7 · zero concluídas em 3 dias · top 3 sem estimativa

## Campos relevantes
estimativa, bloco, importância/urgência, energia, contexto, tags, área, aguardando, subtarefa, recorrência, lixeira (\`deletedAt\`), \`clientKey\`, origem.

Datas na borda: PT-BR, fuso America/Sao_Paulo. Banco em UTC.
`;
}

async function glossaryDoc() {
  const statuses = await prisma.activityStatus.findMany({ orderBy: { order: "asc" } });
  const types = await prisma.activityType.findMany({ orderBy: { name: "asc" } });
  return `# Glossário de status, prioridades e tipos

Gerado do banco em ${new Date().toISOString().slice(0, 10)}.

## Status
${statuses.map((s) => `- \`${s.key}\` — ${s.name}${s.isDone ? " (conclui)" : ""}${s.isInProgress ? " (em andamento)" : ""}`).join("\n") || "- (nenhum)"}

## Prioridades
- \`low\` Baixa · \`normal\` Normal · \`high\` Alta · \`urgent\` Urgente

## Tipos
${types.map((t) => `- ${t.name}`).join("\n") || "- (nenhum)"}
`;
}

async function main() {
  let agent = await prisma.agent.findFirst({
    where: { slug: SLUG },
    include: { workspace: { include: { folders: true } } },
  });

  if (!agent) {
    const created = await createAgentWithRoom({
      name: "Cortex Tempo",
      slug: SLUG,
      role: "Coach de Alta Performance e Gestão de Tempo",
      description:
        "Especialista em gestão de tempo, coach (inclui procrastinação), consultor de organização e personal organizer de rotina digital.",
      status: "active",
      model: "claude-sonnet",
      temperature: 0.3,
      shirtColor: "#0ea5e9",
      accessory: "glasses",
      capabilities: ACTIVITY_TOOLS as object,
    });
    if ("error" in created) {
      console.warn(created.error, "— criando agente sem mesa");
      const last = await prisma.workspace.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
      const room = await prisma.workspace.create({
        data: {
          name: "Sala · Cortex Tempo",
          description: "Sala do agente de gestão de tempo",
          color: "#0ea5e9",
          order: (last?.order ?? -1) + 1,
        },
      });
      await prisma.workspaceFolder.createMany({
        data: ROOM_FOLDERS.map((name, order) => ({ workspaceId: room.id, name, order })),
      });
      agent = await prisma.agent.create({
        data: {
          name: "Cortex Tempo",
          slug: SLUG,
          role: "Coach de Alta Performance e Gestão de Tempo",
          description:
            "Especialista em gestão de tempo, coach (inclui procrastinação), consultor de organização e personal organizer de rotina digital.",
          status: "active",
          shirtColor: "#0ea5e9",
          accessory: "glasses",
          workspaceId: room.id,
          capabilities: ACTIVITY_TOOLS as object,
        },
        include: { workspace: { include: { folders: true } } },
      });
    } else {
      agent = await prisma.agent.findUniqueOrThrow({
        where: { id: created.agent.id },
        include: { workspace: { include: { folders: true } } },
      });
    }
  } else {
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        name: "Cortex Tempo",
        role: "Coach de Alta Performance e Gestão de Tempo",
        status: "active",
        description:
          "Especialista em gestão de tempo, coach (inclui procrastinação), consultor de organização e personal organizer de rotina digital.",
        capabilities: ACTIVITY_TOOLS as object,
      },
    });
  }

  if (!agent.workspaceId) throw new Error("Agente sem sala");
  const workspaceId = agent.workspaceId;

  const folders: Record<string, string> = {};
  for (const [order, name] of ROOM_FOLDERS.entries()) {
    const folder = await ensureFolder(workspaceId, name, order);
    folders[name] = folder.id;
  }

  for (const [order, layer] of LAYERS.entries()) {
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
      create: {
        agentId: agent.id,
        fileId,
        layer: layer.layer as PromptLayer,
        order,
        enabled: true,
      },
      update: { fileId, order, enabled: true },
    });
    console.log("camada", LAYER_LABELS[layer.layer as PromptLayer] ?? layer.layer);
  }

  const generated = [
    ...DOCS,
    {
      folder: "Base de conhecimento",
      title: "Como o agente usa a plataforma",
      kind: "processo",
      tags: ["plataforma", "tools"],
      markdown: platformMapDoc(),
    },
    {
      folder: "Base de conhecimento",
      title: "Glossário de status, prioridades e tipos",
      kind: "referencia",
      tags: ["glossario"],
      markdown: await glossaryDoc(),
    },
  ];

  for (const doc of generated) {
    const saved = await upsertNamedFile({
      workspaceId,
      folderId: folders[doc.folder],
      title: doc.title,
      kind: doc.kind,
      tags: doc.tags,
      markdown: doc.markdown,
    });
    const fileId = saved.file?.id;
    if (!fileId) throw new Error(`Falha ao gravar ${doc.title}`);
    if (doc.folder === "Base de conhecimento" || doc.folder === "Templates") {
      await prisma.agentKnowledge.upsert({
        where: { agentId_fileId: { agentId: agent.id, fileId } },
        create: { agentId: agent.id, fileId },
        update: {},
      });
    }
    console.log(doc.kind, saved.index?.status, doc.title);
  }

  const versions = await prisma.agentPromptVersion.count({ where: { agentId: agent.id } });
  if (versions === 0) {
    const published = await publishPrompt({
      agentId: agent.id,
      note: "v1 seed Cortex Tempo",
      source: "seed",
    });
    console.log("prompt publicado", published.version, published.id);
  } else {
    console.log(`prompt já tem ${versions} versão(ões); não republica`);
  }

  const counts = {
    layers: await prisma.agentPromptLayer.count({ where: { agentId: agent.id } }),
    knowledge: await prisma.agentKnowledge.count({ where: { agentId: agent.id } }),
    files: await prisma.workspaceFile.count({ where: { workspaceId } }),
  };
  console.log(JSON.stringify({ slug: SLUG, agentId: agent.id, workspaceId, ...counts }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
