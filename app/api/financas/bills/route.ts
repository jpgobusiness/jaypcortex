import { monthOf, todayYmd } from "@/lib/finance/dates";
import { monthParam, respond } from "@/lib/finance/http";
import { getBills } from "@/lib/finance/service";

/** Contas a pagar do mês (?month=AAAA-MM; padrão: mês atual). */
export async function GET(request: Request) {
  return respond(() => {
    const value = new URL(request.url).searchParams.get("month");
    return getBills(value ? monthParam(value) : monthOf(todayYmd()));
  });
}
