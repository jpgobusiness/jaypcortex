import { respond } from "@/lib/finance/http";
import { deleteLoan, getLoan } from "@/lib/finance/service";

type Ctx = { params: Promise<{ id: string }> };

/** Empréstimo com a tabela de parcelas, CET e simulação de quitação. */
export async function GET(_request: Request, { params }: Ctx) {
  return respond(async () => getLoan((await params).id));
}

/** Exclui o empréstimo e todas as parcelas lançadas. */
export async function DELETE(_request: Request, { params }: Ctx) {
  return respond(async () => deleteLoan((await params).id));
}
