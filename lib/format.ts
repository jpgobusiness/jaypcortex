// Helpers de formatação (pt-BR).

export function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
    value
  )}%`;
}

/**
 * Extrai ano/mês/dia de uma data civil (YYYY-MM-DD ou ISO meia-noite UTC).
 * Evita o bug clássico: "2026-08-04T00:00:00.000Z" virar dia 03 no fuso BR.
 */
function calendarYmd(
  date: string | Date
): { y: number; m: number; d: number } | null {
  if (typeof date === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
    if (m) {
      return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
    }
  }
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
  };
}

/** Formata data civil (sem horário) em pt-BR, sem deslocar o dia por fuso. */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const parts = calendarYmd(date);
  if (!parts) return "—";
  const utc = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc);
}

/** Converte Date/ISO para o valor de um input type="date" (YYYY-MM-DD). */
export function toDateInput(date: string | Date | null | undefined): string {
  if (!date) return "";
  const parts = calendarYmd(date);
  if (!parts) return "";
  return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}
