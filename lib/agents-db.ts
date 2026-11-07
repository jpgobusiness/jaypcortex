import type { Prisma } from "@/app/generated/prisma-postgres/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_APPEARANCE,
  DESK_COUNT,
  ORCHESTRATOR_ID,
  ROOM_FOLDERS,
  isAccessory,
  isHairStyle,
  roomName,
} from "@/lib/agents";
import type { Agent, AgentKnowledgeItem } from "@/lib/types";

type Tx = Prisma.TransactionClient;

const agentInclude = {
  _count: { select: { knowledge: true } },
  workspace: {
    select: { id: true, name: true, _count: { select: { files: true } } },
  },
} satisfies Prisma.AgentInclude;

type AgentRow = Prisma.AgentGetPayload<{ include: typeof agentInclude }>;

function toAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    role: row.role,
    description: row.description,
    instructions: row.instructions,
    isOrchestrator: row.isOrchestrator,
    deskIndex: row.deskIndex,
    skinTone: row.skinTone,
    hairStyle: isHairStyle(row.hairStyle) ? row.hairStyle : DEFAULT_APPEARANCE.hairStyle,
    hairColor: row.hairColor,
    shirtColor: row.shirtColor,
    accessory: isAccessory(row.accessory) ? row.accessory : "none",
    workspaceId: row.workspaceId,
    knowledgeCount: row._count.knowledge,
    room: row.workspace
      ? {
          id: row.workspace.id,
          name: row.workspace.name,
          fileCount: row.workspace._count.files,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Prisma: violação de chave única (ex.: mesa ou id já usados). */
export function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** Cria a sala (espaço de trabalho) de um agente, com as pastas padrão. */
async function createRoom(tx: Tx, agentName: string, color: string) {
  const last = await tx.workspace.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const workspace = await tx.workspace.create({
    data: {
      name: roomName(agentName),
      description: `Sala do agente ${agentName}: base de conhecimento, templates e entregas.`,
      color,
      order: (last?.order ?? -1) + 1,
    },
  });
  await tx.workspaceFolder.createMany({
    data: ROOM_FOLDERS.map((name, order) => ({
      workspaceId: workspace.id,
      name,
      order,
    })),
  });
  return workspace;
}

/** Garante que o escritório tenha o orquestrador (Cortex). */
export async function ensureOrchestrator() {
  const existing = await prisma.agent.findUnique({
    where: { id: ORCHESTRATOR_ID },
    select: { id: true, slug: true, name: true },
  });
  if (existing) {
    if (existing.slug !== "cortex" || existing.name !== "Cortex") {
      try {
        await prisma.agent.update({
          where: { id: existing.id },
          data: { slug: "cortex", name: "Cortex", role: existing.name ? undefined : "Orquestrador do escritório" },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    return;
  }
  try {
    await prisma.$transaction(async (tx) => {
      const room = await createRoom(tx, "Cortex", "#7b68ee");
      await tx.agent.create({
        data: {
          id: ORCHESTRATOR_ID,
          name: "Cortex",
          slug: "cortex",
          role: "Orquestrador do escritório",
          description:
            "Recebe os pedidos do chat, decide quais agentes chamar e junta as respostas em uma entrega.",
          isOrchestrator: true,
          shirtColor: "#7b68ee",
          workspaceId: room.id,
        },
      });
    });
  } catch (error) {
    // Outra requisição criou o orquestrador ao mesmo tempo.
    if (!isUniqueViolation(error)) throw error;
  }
}

export async function listAgents(): Promise<Agent[]> {
  const rows = await prisma.agent.findMany({
    include: agentInclude,
    orderBy: [{ isOrchestrator: "desc" }, { deskIndex: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toAgent);
}

export async function getAgent(id: string): Promise<Agent | null> {
  const row = await prisma.agent.findUnique({ where: { id }, include: agentInclude });
  return row ? toAgent(row) : null;
}

/** Cria o agente na primeira mesa livre, já com a sala dele. */
export async function createAgentWithRoom(
  data: Omit<Prisma.AgentUncheckedCreateInput, "deskIndex" | "workspaceId" | "isOrchestrator">
): Promise<{ agent: Agent } | { error: string }> {
  const created = await prisma.$transaction(async (tx) => {
    const used = await tx.agent.findMany({
      where: { deskIndex: { not: null } },
      select: { deskIndex: true },
    });
    const taken = new Set(used.map((item) => item.deskIndex));
    let deskIndex: number | null = null;
    for (let index = 0; index < DESK_COUNT; index++) {
      if (!taken.has(index)) {
        deskIndex = index;
        break;
      }
    }
    if (deskIndex === null) return null;

    const room = await createRoom(tx, data.name, data.shirtColor ?? DEFAULT_APPEARANCE.shirtColor);
    return tx.agent.create({
      data: { ...data, deskIndex, workspaceId: room.id, isOrchestrator: false },
      include: agentInclude,
    });
  });

  if (!created) {
    return { error: `O escritório está cheio (${DESK_COUNT} mesas)` };
  }
  return { agent: toAgent(created) };
}

export async function listKnowledge(agentId: string): Promise<AgentKnowledgeItem[]> {
  const links = await prisma.agentKnowledge.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    include: {
      file: {
        select: {
          id: true,
          title: true,
          excerpt: true,
          kind: true,
          indexStatus: true,
          updatedAt: true,
          workspaceId: true,
          workspace: { select: { name: true } },
          folder: { select: { name: true } },
        },
      },
    },
  });
  return links.map((link) => ({
    fileId: link.file.id,
    title: link.file.title,
    excerpt: link.file.excerpt,
    kind: link.file.kind,
    indexStatus: link.file.indexStatus,
    workspaceId: link.file.workspaceId,
    workspaceName: link.file.workspace.name,
    folderName: link.file.folder?.name ?? null,
    updatedAt: link.file.updatedAt.toISOString(),
    attachedAt: link.createdAt.toISOString(),
  }));
}
