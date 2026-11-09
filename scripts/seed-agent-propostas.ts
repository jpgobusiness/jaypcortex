/**
 * Seed idempotente do agente Propostas (slug propostas).
 * Sala padrão, camadas de prompt, routing, vínculo dos templates do espaço Oportunidades.
 *
 * Uso: npm run seed:propostas
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { createAgentWithRoom } from "../lib/agents-db";
import { ROOM_FOLDERS } from "../lib/agents";
import { upsertFileContent } from "../lib/knowledge/files";
import { composeAgentPrompt, publishPrompt } from "../lib/agents/prompt-composer";
import { LAYER_LABELS, type PromptLayer } from "../lib/knowledge/kinds";
import { PROPOSTAS_ROUTING } from "../lib/cortex/default-routing";
import { OPPORTUNITIES_KEY, TEMPLATES_FOLDER } from "../lib/opportunities/templates";
import { LAYERS } from "./data/propostas-content";

const SLUG = "propostas";
const NAME = "Propostas";
const ROLE = "Arquiteto de propostas";

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

async function main() {
  let agent = await prisma.agent.findFirst({
    where: { slug: SLUG },
    include: { workspace: { include: { folders: true } } },
  });

  if (!agent) {
    const created = await createAgentWithRoom({
      name: NAME,
      slug: SLUG,
      role: ROLE,
      description: "Coautoria de Proposal Doc e contexto de oportunidade via MCP, seção por seção.",
      status: "active",
      model: "claude-sonnet",
      temperature: 0.3,
      shirtColor: "#0d9488",
      capabilities: ["proposta", "oportunidade", "transcricao", "escopo"] as object,
    });
    if ("error" in created) {
      console.warn(created.error, "— criando agente sem mesa");
      const last = await prisma.workspace.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
      const room = await prisma.workspace.create({
        data: {
          name: `Sala · ${NAME}`,
          description: "Sala do agente de propostas",
          color: "#0d9488",
          order: (last?.order ?? -1) + 1,
        },
      });
      await prisma.workspaceFolder.createMany({
        data: ROOM_FOLDERS.map((name, order) => ({ workspaceId: room.id, name, order })),
      });
      agent = await prisma.agent.create({
        data: {
          name: NAME,
          slug: SLUG,
          role: ROLE,
          description: "Coautoria de Proposal Doc e contexto de oportunidade via MCP, seção por seção.",
          status: "active",
          shirtColor: "#0d9488",
          workspaceId: room.id,
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
      data: { name: NAME, role: ROLE, status: "active" },
    });
  }

  if (!agent.workspaceId) throw new Error("Agente sem sala");
  const workspaceId = agent.workspaceId;

  await prisma.agent.update({
    where: { id: agent.id },
    data: { routing: PROPOSTAS_ROUTING as object },
  });

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
        layer: layer.layer,
        order,
        enabled: true,
      },
      update: { fileId, order, enabled: true },
    });
    console.log("camada", LAYER_LABELS[layer.layer] ?? layer.layer);
  }

  const opp = await prisma.workspace.findUnique({ where: { key: OPPORTUNITIES_KEY } });
  if (opp) {
    const tplFolder = await prisma.workspaceFolder.findFirst({
      where: { workspaceId: opp.id, name: TEMPLATES_FOLDER },
    });
    if (tplFolder) {
      const templates = await prisma.workspaceFile.findMany({
        where: { folderId: tplFolder.id },
        select: { id: true, title: true },
      });
      for (const file of templates) {
        await prisma.agentKnowledge.upsert({
          where: { agentId_fileId: { agentId: agent.id, fileId: file.id } },
          create: { agentId: agent.id, fileId: file.id },
          update: {},
        });
        console.log("knowledge", file.title);
      }
    }
  } else {
    console.warn("espaço Oportunidades ausente — rode npm run seed:opportunities");
  }

  const { composed } = await composeAgentPrompt(agent.id);
  const last = await prisma.agentPromptVersion.findFirst({
    where: { agentId: agent.id },
    orderBy: { version: "desc" },
  });
  if (!last || last.composedPrompt !== composed) {
    const published = await publishPrompt({
      agentId: agent.id,
      note: last ? "v2 fase C: entrega HTML" : "v1 seed propostas",
      source: "seed",
    });
    console.log("prompt publicado", published.version, published.id);
  } else {
    console.log(`prompt v${last.version} já está atualizado`);
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
