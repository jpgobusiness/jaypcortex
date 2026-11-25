import { readJson, respond } from "@/lib/finance/http";
import { createLoan, listLoans } from "@/lib/finance/service";
import { loanInput, parseInput } from "@/lib/finance/validation";

export async function GET() {
  return respond(() => listLoans());
}

/** Cria o empréstimo e lança as parcelas (Price ou SAC). */
export async function POST(request: Request) {
  return respond(async () => createLoan(parseInput(loanInput, await readJson(request))), 201);
}
