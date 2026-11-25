import { monthOf, todayYmd } from "@/lib/finance/dates";
import { monthParam, respond } from "@/lib/finance/http";
import { getExpenses } from "@/lib/finance/service";

/** Despesas do mês (?month=AAAA-MM) e janela do gráfico (?from&to=AAAA-MM). */
export async function GET(request: Request) {
  return respond(() => {
    const params = new URL(request.url).searchParams;
    const value = params.get("month");
    const from = params.get("from");
    const to = params.get("to");
    return getExpenses(value ? monthParam(value) : monthOf(todayYmd()), from && to ? { from: monthParam(from, "Início"), to: monthParam(to, "Fim") } : undefined);
  });
}
