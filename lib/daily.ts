/** Helpers do módulo Controle Diário de Atividades. */

export function monthKeyFromDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Parse "YYYY-MM" → { year, month (1-12) }. */
export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/** Dias no mês (1–28/29/30/31). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Date UTC meia-noite para YYYY-MM-DD. */
export function dateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function ymdFromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function shiftMonthKey(key: string, delta: number): string {
  const p = parseMonthKey(key);
  if (!p) return key;
  const dt = new Date(p.year, p.month - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const p = parseMonthKey(key);
  if (!p) return key;
  const name = new Date(p.year, p.month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const WEEKDAYS_PT = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

/** Ex.: "01/08 — Segunda-feira" a partir de YYYY-MM-DD. */
export function formatDayLabel(ymd: string): string {
  const parts = dayLabelParts(ymd);
  if (!parts) return ymd;
  return `${parts.dayMonth} — ${parts.weekday}`;
}

export function dayLabelParts(
  ymd: string
): { dayMonth: string; weekday: string } | null {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  // Meio-dia local evita deslocamento de fuso ao pegar o weekday.
  const local = new Date(y, m - 1, d, 12, 0, 0);
  return {
    dayMonth: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`,
    weekday: WEEKDAYS_PT[local.getDay()] ?? "",
  };
}

export type HabitLike = { id: string; active?: boolean };
export type CheckLike = { habitId: string; done: boolean };

/** Pontuação do dia: feitos / hábitos ativos. */
export function dayScore(
  habits: HabitLike[],
  checks: CheckLike[]
): number {
  const active = habits.filter((h) => h.active !== false);
  if (active.length === 0) return 0;
  const byHabit = new Map(checks.map((c) => [c.habitId, c.done]));
  let done = 0;
  for (const h of active) {
    if (byHabit.get(h.id)) done++;
  }
  return (done / active.length) * 100;
}

export function heatmapColor(score: number | null, isFuture: boolean): string {
  if (isFuture || score === null) return "#e2e8f0";
  if (score > 80) return "#22c55e";
  if (score >= 50) return "#facc15";
  return "#ef4444";
}

export const DEFAULT_DAILY_HABITS = [
  "Água",
  "Treino",
  "Alimentação",
  "Fio Dental",
  "Ler 10 min",
  "Trabalhar",
  "Inglês 30 min",
  "No-porn",
  "Arrumar Cama",
];
