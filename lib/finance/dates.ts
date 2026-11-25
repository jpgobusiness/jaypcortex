// Datas civis como texto "YYYY-MM-DD" e meses como "YYYY-MM".
// Comparar strings nesse formato já dá a ordem cronológica.

export type Ymd = string;
export type MonthKey = string;

const pad = (value: number) => String(value).padStart(2, "0");

export function ymd(year: number, month: number, day: number): Ymd {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseYmd(value: Ymd) {
  const [y, m, d] = value.split("-").map(Number);
  return { y, m, d };
}

export function isYmd(value: unknown): value is Ymd {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { y, m, d } = parseYmd(value);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthOf(value: Ymd): MonthKey {
  return value.slice(0, 7);
}

export function addMonthsToKey(key: MonthKey, months: number): MonthKey {
  const [y, m] = key.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** Dia `day` do mês, limitado ao último dia (31 em fevereiro → 28/29). */
export function dayInMonth(key: MonthKey, day: number): Ymd {
  const [y, m] = key.split("-").map(Number);
  return ymd(y, m, Math.min(day, daysInMonth(y, m)));
}

/** Soma meses mantendo o dia (ou o mais perto possível). */
export function addMonthsYmd(value: Ymd, months: number, day = parseYmd(value).d): Ymd {
  return dayInMonth(addMonthsToKey(monthOf(value), months), day);
}

export function toDateUtc(value: Ymd): Date {
  const { y, m, d } = parseYmd(value);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysYmd(value: Ymd, days: number): Ymd {
  const date = toDateUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toYmd(date);
}

/** Dias de `from` até `to` (negativo se `to` for antes). */
export function diffDays(from: Ymd, to: Ymd): number {
  return Math.round((toDateUtc(to).getTime() - toDateUtc(from).getTime()) / 86_400_000);
}

/** 0 = domingo ... 6 = sábado. */
export function weekday(value: Ymd): number {
  return toDateUtc(value).getUTCDay();
}

/** Vencimento em sábado ou domingo passa para segunda (Lei 7.089/1983). */
export function nextBusinessDay(value: Ymd): Ymd {
  const day = weekday(value);
  if (day === 6) return addDaysYmd(value, 2);
  if (day === 0) return addDaysYmd(value, 1);
  return value;
}

/** Date (meia-noite UTC, como o Postgres devolve DATE) ou ISO → "YYYY-MM-DD". */
export function toYmd(value: Date | string): Ymd {
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    value = new Date(value);
  }
  return ymd(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

/** Hoje no fuso da plataforma (o servidor da Vercel roda em UTC). */
export function todayYmd(timeZone = "America/Sao_Paulo", now = new Date()): Ymd {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Meses de `from` até `to`, inclusive. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const keys: MonthKey[] = [];
  for (let key = from; key <= to && keys.length < 600; key = addMonthsToKey(key, 1)) keys.push(key);
  return keys;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-11" → "nov/26" */
export function shortMonth(key: MonthKey): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]}/${String(y).slice(2)}`;
}

/** "2026-11" → "novembro de 2026" */
export function longMonth(key: MonthKey): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} de ${y}`;
}

/** "2026-11-05" → "05/11/2026" (ou "05/11" sem o ano). */
export function formatYmd(value: Ymd | null | undefined, withYear = true): string {
  if (!value) return "—";
  const { y, m, d } = parseYmd(value);
  return withYear ? `${pad(d)}/${pad(m)}/${y}` : `${pad(d)}/${pad(m)}`;
}
