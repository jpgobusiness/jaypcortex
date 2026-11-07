"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/fetcher";

type Presented = { id: string; title: string; score?: number; reasons?: string[]; due_text?: string | null };
type Alert = { level: "critico" | "atencao" | "info"; text: string };
type Briefing = {
  date: string;
  top3: Presented[];
  alerts: Alert[];
  suggestions: string[];
  load: { estimatedMinutes: number; freeMinutes: number; capacityMinutes: number; overbooked: boolean };
};

const LEVEL: Record<Alert["level"], string> = {
  critico: "bg-red-50 text-red-700",
  atencao: "bg-amber-50 text-amber-800",
  info: "bg-slate-50 text-slate-600",
};

export default function TodayBriefing({ onOpen }: { onOpen?: (id: string) => void }) {
  const [data, setData] = useState<Briefing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Briefing>("/api/activities/briefing")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Falha no briefing"));
  }, []);

  if (error) return null;
  if (!data) {
    return <div className="mb-4 h-24 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />;
  }

  return (
    <section className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Hoje</h2>
        <p className="text-[11px] text-[var(--muted)]">
          Carga {data.load.estimatedMinutes} min · livres {data.load.freeMinutes} min
          {data.load.overbooked ? " · sobrecarga" : ""}
        </p>
      </div>
      <ol className="mb-3 grid gap-2 sm:grid-cols-3">
        {(data.top3.length ? data.top3 : [{ id: "", title: "Nada no topo da lista" }]).map((item, i) => (
          <li key={item.id || i}>
            <button
              type="button"
              disabled={!item.id || !onOpen}
              onClick={() => item.id && onOpen?.(item.id)}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-left text-sm disabled:cursor-default"
            >
              <span className="mr-1 text-[11px] font-bold text-[var(--muted)]">{i + 1}.</span>
              {item.title}
              {item.reasons?.length ? (
                <span className="mt-1 block text-[11px] text-[var(--muted)]">{item.reasons.join(" · ")}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ol>
      {data.alerts.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {data.alerts.map((a) => (
            <li key={a.text} className={`rounded-full px-2 py-0.5 text-[11px] ${LEVEL[a.level]}`}>
              {a.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
