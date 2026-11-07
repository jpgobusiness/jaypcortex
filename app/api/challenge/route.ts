import { NextResponse } from "next/server";
import { currentMonthKey } from "@/lib/daily";

/** Compat: redireciona clientes antigos para o mês atual. */
export async function GET(req: Request) {
  const key = currentMonthKey();
  const url = new URL(req.url);
  return NextResponse.redirect(
    `${url.origin}/api/challenge/month/${key}`,
    307
  );
}
