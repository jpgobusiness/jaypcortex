import type { BusyBlock } from "@/lib/briefing/briefing";
import { liveGestaoTempo } from "./gestao-tempo";
import { liveMigracaoAws } from "./migracao-aws";

export type LiveDataFn = (
  request: string,
  opts: { date?: Date; busyBlocks?: BusyBlock[] }
) => Promise<unknown>;

const registry: Record<string, LiveDataFn> = {
  "gestao-tempo": liveGestaoTempo,
  "migracao-aws": (request) => liveMigracaoAws(request),
};

export function liveDataFor(slug: string): LiveDataFn | null {
  return registry[slug] ?? null;
}
