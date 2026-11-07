export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";

const WEEKDAYS: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, "segunda-feira": 1, seg: 1,
  terca: 2, terça: 2, "terca-feira": 2, "terça-feira": 2, ter: 2,
  quarta: 3, "quarta-feira": 3, qua: 3,
  quinta: 4, "quinta-feira": 4, qui: 4,
  sexta: 5, "sexta-feira": 5, sex: 5,
  sabado: 6, sábado: 6, sab: 6, sáb: 6,
};

export type ZonedParts = { y: number; m: number; d: number; h: number; min: number; weekday: number };

export function zonedParts(date = new Date(), tz = APP_TIMEZONE): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const wd: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    h: Number(map.hour),
    min: Number(map.minute),
    weekday: wd[map.weekday] ?? 0,
  };
}

/** Meia-noite UTC da data civil (igual ao `dt()` das rotas atuais). */
export function civilUtc(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min, 0));
}

export function addDaysCivil(p: ZonedParts, days: number): ZonedParts {
  const dt = civilUtc(p.y, p.m, p.d);
  dt.setUTCDate(dt.getUTCDate() + days);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), h: p.h, min: p.min, weekday: dt.getUTCDay() };
}

export function formatLocal(date: Date | string | null | undefined, tz = APP_TIMEZONE): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatLocalDate(date: Date | string | null | undefined, tz = APP_TIMEZONE): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const dateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: dateOnly ? "UTC" : tz,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(d);
}

export type ParsedDate = { date: Date; interpreted_as: string };

export function parseDatePhrase(raw: string | Date | null | undefined, now = new Date()): ParsedDate | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return { date: raw, interpreted_as: raw.toISOString() };
  }
  const text = raw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!text) return null;
  const today = zonedParts(now);
  if (text === "hoje") return { date: civilUtc(today.y, today.m, today.d), interpreted_as: "hoje" };
  if (text === "amanha") {
    const n = addDaysCivil(today, 1);
    return { date: civilUtc(n.y, n.m, n.d), interpreted_as: "amanhã" };
  }
  if (text === "ontem") {
    const n = addDaysCivil(today, -1);
    return { date: civilUtc(n.y, n.m, n.d), interpreted_as: "ontem" };
  }
  if (text.includes("proxima semana") || text.includes("semana que vem")) {
    const n = addDaysCivil(today, 7 - today.weekday + 1);
    return { date: civilUtc(n.y, n.m, n.d), interpreted_as: "próxima segunda" };
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[t ](\d{2}):(\d{2}))?/.exec(text);
  if (iso) {
    const date = civilUtc(Number(iso[1]), Number(iso[2]), Number(iso[3]), Number(iso[4] || 0), Number(iso[5] || 0));
    return { date, interpreted_as: date.toISOString() };
  }
  const br = /^(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?$/.exec(text);
  if (br) {
    const d = Number(br[1]);
    const m = Number(br[2]);
    let y = br[3] ? Number(br[3]) : today.y;
    if (y < 100) y += 2000;
    let date = civilUtc(y, m, d);
    if (date.getTime() < civilUtc(today.y, today.m, today.d).getTime() && !br[3]) {
      date = civilUtc(y + 1, m, d);
    }
    return { date, interpreted_as: `${d}/${m}/${date.getUTCFullYear()}` };
  }
  const dia = /^dia\s+(\d{1,2})$/.exec(text);
  if (dia) {
    const d = Number(dia[1]);
    let y = today.y;
    let m = today.m;
    if (d < today.d) {
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return { date: civilUtc(y, m, d), interpreted_as: `dia ${d}/${m}` };
  }
  for (const [name, wd] of Object.entries(WEEKDAYS)) {
    if (text === name || text === `proxima ${name}` || text === `proximo ${name}`) {
      let delta = (wd - today.weekday + 7) % 7;
      if (delta === 0) delta = 7;
      const n = addDaysCivil(today, delta);
      return { date: civilUtc(n.y, n.m, n.d), interpreted_as: name };
    }
  }
  const native = new Date(raw);
  if (!Number.isNaN(native.getTime())) return { date: native, interpreted_as: native.toISOString() };
  return null;
}

export function startOfWeekMonday(now = new Date()): Date {
  const t = zonedParts(now);
  const delta = (t.weekday + 6) % 7;
  const n = addDaysCivil(t, -delta);
  return civilUtc(n.y, n.m, n.d);
}

export function isSameCivil(a: Date, b: Date): boolean {
  const pa = zonedParts(a);
  const pb = zonedParts(b);
  return pa.y === pb.y && pa.m === pb.m && pa.d === pb.d;
}

/** Próxima ocorrência simples a partir de RRULE (DAILY/WEEKLY/MONTHLY). */
export function nextDueFromRrule(rule: string, from: Date): Date | null {
  const up = rule.toUpperCase();
  const d = new Date(from.getTime());
  if (up.includes("FREQ=DAILY")) {
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  if (up.includes("FREQ=WEEKLY")) {
    d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }
  if (up.includes("FREQ=MONTHLY")) {
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
  }
  return null;
}

export function daysUntilDue(due: Date, now = new Date()): number {
  const da = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const b = zonedParts(now);
  const db = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((da - db) / 86400000);
}
