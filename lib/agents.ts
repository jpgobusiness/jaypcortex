// Escritório de agentes: opções de aparência, limites e validação.
// Usado no navegador e nas APIs.

import type { AgentAccessory, AgentAppearance, AgentHairStyle } from "@/lib/types";
import { isHexColor } from "@/lib/workspaces";

/** Mesas no escritório (2 fileiras de 5). */
export const DESK_COUNT = 10;
/** Id fixo do orquestrador: evita criar dois em requisições simultâneas. */
export const ORCHESTRATOR_ID = "cortex-orchestrator";

export const AGENT_NAME_MAX = 40;
export const AGENT_ROLE_MAX = 60;
export const AGENT_DESCRIPTION_MAX = 600;
export const AGENT_INSTRUCTIONS_MAX = 8000;

/** Pastas criadas na sala de cada agente novo. */
export const ROOM_FOLDERS = ["Prompt", "Base de conhecimento", "Templates", "Entregas"] as const;
export const KNOWLEDGE_FOLDER = "Base de conhecimento";

export const SKIN_TONES = [
  { value: "#f3d2bd", label: "Clara" },
  { value: "#e2b08c", label: "Média clara" },
  { value: "#c68a62", label: "Média" },
  { value: "#93603f", label: "Morena" },
  { value: "#65402b", label: "Escura" },
] as const;

export const HAIR_STYLES: { value: AgentHairStyle; label: string }[] = [
  { value: "short", label: "Curto" },
  { value: "spiky", label: "Espetado" },
  { value: "bob", label: "Chanel" },
  { value: "curly", label: "Cacheado" },
  { value: "bun", label: "Coque" },
  { value: "long", label: "Longo" },
  { value: "beanie", label: "Gorro" },
];

export const HAIR_COLORS = [
  { value: "#1d1512", label: "Preto" },
  { value: "#4a2f1d", label: "Castanho" },
  { value: "#8a4b26", label: "Ruivo" },
  { value: "#d9b46c", label: "Loiro" },
  { value: "#a3a8b0", label: "Grisalho" },
  { value: "#2563eb", label: "Azul" },
  { value: "#7b68ee", label: "Roxo" },
] as const;

export const SHIRT_COLORS = [
  { value: "#4f46e5", label: "Índigo" },
  { value: "#2563eb", label: "Azul" },
  { value: "#0891b2", label: "Ciano" },
  { value: "#16a34a", label: "Verde" },
  { value: "#eab308", label: "Amarelo" },
  { value: "#ea580c", label: "Laranja" },
  { value: "#db2777", label: "Rosa" },
  { value: "#7c3aed", label: "Violeta" },
  { value: "#334155", label: "Grafite" },
] as const;

export const ACCESSORIES: { value: AgentAccessory; label: string }[] = [
  { value: "none", label: "Nenhum" },
  { value: "headphones", label: "Fone" },
  { value: "glasses", label: "Óculos" },
];

export const DEFAULT_APPEARANCE: AgentAppearance = {
  skinTone: SKIN_TONES[2].value,
  hairStyle: "short",
  hairColor: HAIR_COLORS[0].value,
  shirtColor: SHIRT_COLORS[0].value,
  accessory: "none",
};

export function isHairStyle(value: unknown): value is AgentHairStyle {
  return HAIR_STYLES.some((item) => item.value === value);
}

export function isAccessory(value: unknown): value is AgentAccessory {
  return ACCESSORIES.some((item) => item.value === value);
}

type FieldRule = { key: string; label: string; max: number; required?: boolean };

const TEXT_RULES: FieldRule[] = [
  { key: "name", label: "Nome", max: AGENT_NAME_MAX, required: true },
  { key: "role", label: "Cargo", max: AGENT_ROLE_MAX },
  { key: "description", label: "Descrição", max: AGENT_DESCRIPTION_MAX },
  { key: "instructions", label: "Instruções", max: AGENT_INSTRUCTIONS_MAX },
];

export type AgentInput = Partial<
  AgentAppearance & {
    name: string;
    role: string;
    description: string;
    instructions: string;
  }
>;

/**
 * Lê e valida os campos editáveis de um agente vindos da API.
 * `partial` aceita só os campos enviados (para edição).
 */
export function parseAgentInput(
  body: Record<string, unknown>,
  { partial }: { partial: boolean }
): { data: AgentInput } | { error: string } {
  const data: AgentInput = {};

  for (const rule of TEXT_RULES) {
    const raw = body[rule.key];
    if (raw === undefined) {
      if (rule.required && !partial) return { error: `${rule.label} é obrigatório` };
      continue;
    }
    if (typeof raw !== "string") return { error: `${rule.label} inválido` };
    const value = rule.key === "instructions" ? raw.trim() : raw.trim().replace(/\s+/g, " ");
    if (rule.required && !value) return { error: `${rule.label} é obrigatório` };
    if (value.length > rule.max) {
      return { error: `${rule.label} pode ter até ${rule.max} caracteres` };
    }
    data[rule.key as "name" | "role" | "description" | "instructions"] = value;
  }

  for (const key of ["skinTone", "hairColor", "shirtColor"] as const) {
    const raw = body[key];
    if (raw === undefined) continue;
    if (!isHexColor(raw)) return { error: "Cor inválida" };
    data[key] = raw;
  }
  if (body.hairStyle !== undefined) {
    if (!isHairStyle(body.hairStyle)) return { error: "Cabelo inválido" };
    data.hairStyle = body.hairStyle;
  }
  if (body.accessory !== undefined) {
    if (!isAccessory(body.accessory)) return { error: "Acessório inválido" };
    data.accessory = body.accessory;
  }

  return { data };
}

export function officeHref(agentId?: string) {
  return agentId ? `/escritorio?agente=${agentId}` : "/escritorio";
}

export function roomName(agentName: string) {
  return `Sala de ${agentName}`;
}

/** Primeiro nome, para balões e etiquetas. */
export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}
