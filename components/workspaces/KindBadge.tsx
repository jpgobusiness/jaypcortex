import { KIND_COLORS, KIND_LABELS, isDocumentKind } from "@/lib/knowledge/kinds";

export default function KindBadge({ kind }: { kind?: string | null }) {
  if (!kind || !isDocumentKind(kind)) return null;
  const colors = KIND_COLORS[kind];
  return (
    <span
      className="inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      {KIND_LABELS[kind]}
    </span>
  );
}
