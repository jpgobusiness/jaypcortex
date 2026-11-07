// Utilitários de chave de mês "YYYY-MM" (uso no cliente).

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "2026-07" -> "Julho de 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1] ?? "?"} de ${y}`;
}

/** "2026-07" -> "Jul/26" (para gráficos) */
export function monthShortLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${(MONTHS[m - 1] ?? "?").slice(0, 3)}/${String(y).slice(2)}`;
}

/** Primeiro dia do mês como valor de input date (YYYY-MM-DD). */
export function monthFirstDay(key: string): string {
  return `${key}-01`;
}
