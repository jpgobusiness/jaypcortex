import { readJson, respond } from "@/lib/finance/http";
import { settleLoan } from "@/lib/finance/service";
import { loanSettleInput, parseInput } from "@/lib/finance/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Quita as parcelas em aberto e lança o débito no mês atual. */
export async function POST(request: Request, { params }: Ctx) {
  return respond(async () => settleLoan((await params).id, parseInput(loanSettleInput, await readJson(request))));
}
