import {
  ACCESSORIES,
  HAIR_COLORS,
  HAIR_STYLES,
  SHIRT_COLORS,
  SKIN_TONES,
} from "@/lib/agents";
import type { AgentAppearance } from "@/lib/types";

type Preset = AgentAppearance & {
  name: string;
  role: string;
  description: string;
};

/** Equipe sugerida para começar. Tudo pode ser editado ou excluído depois. */
export const STARTER_TEAM: Preset[] = [
  {
    name: "Ana",
    role: "Pesquisadora",
    description: "Pesquisa mercado, clientes e concorrentes e resume o que importa em poucos tópicos.",
    skinTone: "#f3d2bd",
    hairStyle: "bob",
    hairColor: "#4a2f1d",
    shirtColor: "#16a34a",
    accessory: "none",
  },
  {
    name: "Leo",
    role: "Redator de propostas",
    description: "Escreve propostas comerciais e e-mails a partir dos templates guardados na sala dele.",
    skinTone: "#93603f",
    hairStyle: "short",
    hairColor: "#1d1512",
    shirtColor: "#4f46e5",
    accessory: "headphones",
  },
  {
    name: "Bia",
    role: "Analista de dados",
    description: "Monta números, tabelas e resumos a partir de planilhas e relatórios.",
    skinTone: "#65402b",
    hairStyle: "curly",
    hairColor: "#1d1512",
    shirtColor: "#eab308",
    accessory: "none",
  },
  {
    name: "Rafa",
    role: "Arquiteto de soluções",
    description: "Desenha arquiteturas de migração para a nuvem e estima esforço e custo.",
    skinTone: "#e2b08c",
    hairStyle: "spiky",
    hairColor: "#1d1512",
    shirtColor: "#0891b2",
    accessory: "glasses",
  },
  {
    name: "Duda",
    role: "Gestora de projetos",
    description: "Quebra os pedidos em tarefas, prazos e responsáveis e acompanha as entregas.",
    skinTone: "#c68a62",
    hairStyle: "bun",
    hairColor: "#8a4b26",
    shirtColor: "#ea580c",
    accessory: "none",
  },
];

/** Aparência variada para o próximo agente, conforme quantos já existem. */
export function suggestedLook(index: number): AgentAppearance {
  return {
    skinTone: SKIN_TONES[(index * 3 + 2) % SKIN_TONES.length].value,
    hairStyle: HAIR_STYLES[(index * 2) % HAIR_STYLES.length].value,
    hairColor: HAIR_COLORS[index % 4].value,
    shirtColor: SHIRT_COLORS[(index * 4) % SHIRT_COLORS.length].value,
    accessory: ACCESSORIES[index % ACCESSORIES.length].value,
  };
}
