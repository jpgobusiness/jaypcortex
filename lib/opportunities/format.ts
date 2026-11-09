import { zonedParts } from "@/lib/activities/dates";
import type { FunnelOpportunityChip } from "@/lib/types";

export function transcriptTitle(date = new Date()) {
  const p = zonedParts(date);
  const mm = String(p.m).padStart(2, "0");
  const dd = String(p.d).padStart(2, "0");
  return `Transcrição ${p.y}-${mm}-${dd}`;
}

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function opportunityChipLabel(row: FunnelOpportunityChip) {
  const client = row.client?.trim();
  const stage = row.stage?.name;
  const parts = [client || row.name];
  if (stage) parts.push(stage);
  if (row.value) parts.push(formatBRL(row.value));
  return parts.join(" · ");
}
