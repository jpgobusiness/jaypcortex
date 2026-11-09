export const DOCUMENT_KINDS = [
  "contexto",
  "metodologia",
  "processo",
  "passo_a_passo",
  "template",
  "referencia",
  "prompt",
  "faq",
  "caso",
  "transcricao",
  "proposal_doc",
  "arquitetura",
  "nota",
  "entrega",
  "outro",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const KIND_LABELS: Record<DocumentKind, string> = {
  contexto: "Contexto",
  metodologia: "Metodologia",
  processo: "Processo",
  passo_a_passo: "Passo a passo",
  template: "Template",
  referencia: "Referência",
  prompt: "Prompt",
  faq: "FAQ",
  caso: "Caso",
  transcricao: "Transcrição",
  proposal_doc: "Proposal Doc",
  arquitetura: "Arquitetura",
  nota: "Nota",
  entrega: "Entrega",
  outro: "Outro",
};

export const PROMPT_LAYERS = [
  "identidade",
  "missao",
  "roteamento",
  "regras",
  "metodologia",
  "comportamental",
  "formato_saida",
  "exemplos",
  "guardrails",
] as const;

export type PromptLayer = (typeof PROMPT_LAYERS)[number];

export const LAYER_LABELS: Record<PromptLayer, string> = {
  identidade: "Identidade",
  missao: "Missão",
  roteamento: "Roteamento",
  regras: "Regras",
  metodologia: "Metodologia",
  comportamental: "Comportamental",
  formato_saida: "Formato de saída",
  exemplos: "Exemplos",
  guardrails: "Guardrails",
};

export const KIND_COLORS: Record<DocumentKind, { bg: string; fg: string }> = {
  contexto: { bg: "#dbeafe", fg: "#1d4ed8" },
  metodologia: { bg: "#e0e7ff", fg: "#4338ca" },
  processo: { bg: "#e0f2fe", fg: "#0369a1" },
  passo_a_passo: { bg: "#ccfbf1", fg: "#0f766e" },
  template: { bg: "#e0e7ff", fg: "#3730a3" },
  referencia: { bg: "#f1f5f9", fg: "#475569" },
  prompt: { bg: "#fae8ff", fg: "#a21caf" },
  faq: { bg: "#fef3c7", fg: "#b45309" },
  caso: { bg: "#ffe4e6", fg: "#be123c" },
  transcricao: { bg: "#fce7f3", fg: "#be185d" },
  proposal_doc: { bg: "#ffedd5", fg: "#c2410c" },
  arquitetura: { bg: "#ede9fe", fg: "#6d28d9" },
  nota: { bg: "#fef9c3", fg: "#a16207" },
  entrega: { bg: "#dcfce7", fg: "#15803d" },
  outro: { bg: "#f1f5f9", fg: "#334155" },
};

export function isDocumentKind(value: unknown): value is DocumentKind {
  return typeof value === "string" && (DOCUMENT_KINDS as readonly string[]).includes(value);
}

export function isPromptLayer(value: unknown): value is PromptLayer {
  return typeof value === "string" && (PROMPT_LAYERS as readonly string[]).includes(value);
}
