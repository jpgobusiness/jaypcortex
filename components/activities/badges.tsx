import {
  ACTIVITY_PRIORITY_LABELS,
  type ActivityPriority,
} from "@/lib/types";

// Status agora é dinâmico: recebe nome e cor da definição do status.
export function StatusBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  );
}

const PRIORITY_COLORS: Record<ActivityPriority, string> = {
  low: "#94a3b8",
  normal: "#6366f1",
  high: "#f59e0b",
  urgent: "#ef4444",
};

export function PriorityBadge({ priority }: { priority: ActivityPriority }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      style={{ color: PRIORITY_COLORS[priority] }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: PRIORITY_COLORS[priority] }}
      />
      {ACTIVITY_PRIORITY_LABELS[priority]}
    </span>
  );
}
