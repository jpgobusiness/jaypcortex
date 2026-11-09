"use client";

import Link from "next/link";
import { formatBRL, opportunityChipLabel } from "@/lib/opportunities/format";
import type { FunnelOpportunityChip } from "@/lib/types";

export default function OpportunityChip({
  opportunity,
}: {
  opportunity: FunnelOpportunityChip;
}) {
  return (
    <Link
      href={`/comercial/${opportunity.id}`}
      title={opportunityChipLabel(opportunity)}
      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[11px] text-[var(--foreground)] hover:border-[var(--brand)]"
    >
      {opportunity.stage && (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: opportunity.stage.color }}
          aria-hidden
        />
      )}
      <span className="truncate">
        {opportunity.client || opportunity.name}
        {opportunity.stage ? ` · ${opportunity.stage.name}` : ""}
        {opportunity.value ? ` · ${formatBRL(opportunity.value)}` : ""}
      </span>
    </Link>
  );
}
