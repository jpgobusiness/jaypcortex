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

export function isDocumentKind(value: unknown): value is DocumentKind {
  return typeof value === "string" && (DOCUMENT_KINDS as readonly string[]).includes(value);
}

export function isPromptLayer(value: unknown): value is PromptLayer {
  return typeof value === "string" && (PROMPT_LAYERS as readonly string[]).includes(value);
}
