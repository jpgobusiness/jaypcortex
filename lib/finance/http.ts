// Respostas das rotas de finanças: erros de negócio viram 4xx com mensagem; o resto, 500 genérico.
import { NextResponse } from "next/server";
import { isMonthKey, type MonthKey } from "./dates";
import { FinanceError } from "./validation";

export async function respond(run: () => Promise<unknown>, status = 200) {
  try {
    const data = await run();
    return NextResponse.json(data ?? { ok: true }, { status });
  } catch (error) {
    if (error instanceof FinanceError) return NextResponse.json({ error: error.message }, { status: error.status });
    const code = (error as { code?: string } | null)?.code;
    if (code === "P2025") return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    if (code === "P2003") return NextResponse.json({ error: "Este registro está em uso por outros lançamentos" }, { status: 409 });
    console.error("[financas]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new FinanceError("Corpo da requisição inválido");
  }
}

export function monthParam(value: string | null, label = "Mês"): MonthKey {
  if (!isMonthKey(value)) throw new FinanceError(`${label} inválido (use AAAA-MM)`);
  return value;
}
