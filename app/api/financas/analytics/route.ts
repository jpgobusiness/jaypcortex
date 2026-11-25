import { monthRange } from "@/lib/finance/dates";
import { monthParam, respond } from "@/lib/finance/http";
import { getAnalytics } from "@/lib/finance/service";
import { FinanceError } from "@/lib/finance/validation";

/** Dados das visões e dashboards: ?from=AAAA-MM&to=AAAA-MM (até 60 meses). */
export async function GET(request: Request) {
  return respond(() => {
    const params = new URL(request.url).searchParams;
    const from = monthParam(params.get("from"), "Início");
    const to = monthParam(params.get("to"), "Fim");
    if (from > to) throw new FinanceError("O início precisa ser antes do fim");
    if (monthRange(from, to).length > 60) throw new FinanceError("Período máximo: 60 meses");
    return getAnalytics(from, to);
  });
}
