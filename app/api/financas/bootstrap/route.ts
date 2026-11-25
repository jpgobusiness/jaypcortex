import { respond } from "@/lib/finance/http";
import { getBootstrap } from "@/lib/finance/service";

/** Contas (com saldo), cartões (com limite e fatura aberta) e categorias. */
export async function GET() {
  return respond(() => getBootstrap());
}
