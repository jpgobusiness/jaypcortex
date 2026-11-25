import { isMonthKey } from "@/lib/finance/dates";
import { readJson, respond } from "@/lib/finance/http";
import { createEntry, listTransactions, type TransactionFilter } from "@/lib/finance/service";
import { entryInput, parseInput } from "@/lib/finance/validation";

const KINDS = new Set(["income", "expense", "other"]);
const STATUSES = new Set(["paid", "pending", "overdue"]);

/** Filtros: month (AAAA-MM), accountId, cardId, categoryId, kind, status, q. */
export async function GET(request: Request) {
  return respond(() => {
    const params = new URL(request.url).searchParams;
    const get = (name: string) => params.get(name)?.trim() || undefined;
    const month = get("month");
    const kind = get("kind");
    const status = get("status");
    const filter: TransactionFilter = {
      month: month && isMonthKey(month) ? month : undefined,
      accountId: get("accountId"),
      cardId: get("cardId"),
      categoryId: get("categoryId"),
      kind: kind && KINDS.has(kind) ? (kind as TransactionFilter["kind"]) : undefined,
      status: status && STATUSES.has(status) ? (status as TransactionFilter["status"]) : undefined,
      q: get("q")?.slice(0, 80),
    };
    return listTransactions(filter);
  });
}

/** Cria lançamento: pontual, compra no cartão (parcelada), recorrente ou transferência. */
export async function POST(request: Request) {
  return respond(async () => createEntry(parseInput(entryInput, await readJson(request))), 201);
}
