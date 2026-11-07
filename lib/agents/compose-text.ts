import { LAYER_LABELS, type PromptLayer } from "@/lib/knowledge/kinds";

export function composePromptText(
  layers: { layer: string; text: string; enabled: boolean }[],
  instructions: string,
  catalog: { kind: string; title: string }[]
): string {
  const parts: string[] = [];
  for (const layer of layers.filter((l) => l.enabled)) {
    const label = LAYER_LABELS[layer.layer as PromptLayer] ?? layer.layer;
    parts.push(`## ${label}\n\n${layer.text}`.trim());
  }
  if (instructions.trim()) {
    parts.push(`## Regras (legado)\n\n${instructions.trim()}`);
  }
  const catalogText = catalog.map((k) => `- [${k.kind}] ${k.title}`).join("\n");
  if (catalogText) {
    parts.push(`## Base de conhecimento disponível\n\n${catalogText}`);
  }
  return parts.join("\n\n").trim();
}
