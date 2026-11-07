import type { Workspace } from "@/lib/types";

const SIZES = {
  sm: "h-5 w-5 rounded-md text-[10px]",
  md: "h-9 w-9 rounded-lg text-sm",
  lg: "h-12 w-12 rounded-xl text-lg",
};

/** Quadrado com a cor e a inicial do espaço. */
export default function WorkspaceBadge({
  workspace,
  size = "sm",
}: {
  workspace: Pick<Workspace, "name" | "color">;
  size?: keyof typeof SIZES;
}) {
  const initial = Array.from(workspace.name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center font-semibold text-white ring-1 ring-white/40 ${SIZES[size]}`}
      style={{ backgroundColor: workspace.color }}
    >
      {initial}
    </span>
  );
}
