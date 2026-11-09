import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Não encontrado") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(data: unknown) {
  return NextResponse.json(data, { status: 409 });
}

export function serverError(err: unknown) {
  const message = err instanceof Error ? err.message : "Erro interno";
  console.error(err);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Converte string/number para número ou null. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Converte para Date ou null.
 *  Strings YYYY-MM-DD são tratadas como data civil em UTC (meia-noite),
 *  para o dia selecionado no input não “voltar” um dia no fuso BR.
 */
export function dt(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    if (m) {
      return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    }
  }
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Retorna string ou null (trim). */
export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
