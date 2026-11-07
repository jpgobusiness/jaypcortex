import { Bot } from "lucide-react";
import type { Agent } from "@/lib/types";

const SIZES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-10 w-10 text-sm",
};

/** Círculo com a cor da roupa e a inicial do agente (o Cortex usa o robô). */
export default function AgentAvatar({
  agent,
  size = "md",
}: {
  agent: Pick<Agent, "name" | "shirtColor" | "isOrchestrator">;
  size?: keyof typeof SIZES;
}) {
  if (agent.isOrchestrator) {
    return (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#22d3ee] via-[#6d6af3] to-[#7b68ee] text-white shadow-sm ${SIZES[size]}`}
      >
        <Bot className={size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5"} />
      </span>
    );
  }
  const initial = Array.from(agent.name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ${SIZES[size]}`}
      style={{ backgroundColor: agent.shirtColor }}
    >
      {initial}
    </span>
  );
}
