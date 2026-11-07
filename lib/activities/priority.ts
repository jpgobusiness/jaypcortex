import { daysUntilDue } from "./dates";

export type PriorityInput = {
  priority?: string | null;
  importance?: number | null;
  urgency?: number | null;
  dueDate?: Date | string | null;
  queueOrder?: number | null;
  statusIsInProgress?: boolean;
  waitingOn?: string | null;
  now?: Date;
};

const BASE: Record<string, number> = { urgent: 40, high: 30, normal: 15, low: 5 };

export function scoreActivity(input: PriorityInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = BASE[input.priority || "normal"] ?? 15;
  if (input.priority === "urgent") reasons.push("urgente");
  if (input.priority === "high") reasons.push("prioridade alta");
  if (input.importance) {
    score += input.importance * 5;
    if (input.importance >= 3) reasons.push("importante");
  }
  if (input.urgency) {
    score += input.urgency * 5;
    if (input.urgency >= 3) reasons.push("eixo urgente");
  }
  if (input.dueDate) {
    const due = typeof input.dueDate === "string" ? new Date(input.dueDate) : input.dueDate;
    const days = daysUntilDue(due, input.now);
    if (days < 0) {
      score += 30;
      reasons.push(`atrasada ${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"}`);
    } else if (days === 0) {
      score += 25;
      reasons.push("vence hoje");
    } else if (days === 1) {
      score += 15;
      reasons.push("vence amanhã");
    } else if (days <= 7) {
      score += 8;
      reasons.push("vence nesta semana");
    }
  }
  if (input.queueOrder != null) {
    const bonus = Math.max(0, 10 - input.queueOrder);
    score += bonus;
    if (input.queueOrder <= 3) reasons.push(`#${input.queueOrder} da fila`);
  }
  if (input.statusIsInProgress) {
    score += 10;
    reasons.push("em andamento");
  }
  if (input.waitingOn?.trim()) {
    score -= 15;
    reasons.push(`aguardando ${input.waitingOn.trim()}`);
  }
  return { score, reasons };
}
