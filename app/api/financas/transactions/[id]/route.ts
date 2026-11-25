import { readJson, respond } from "@/lib/finance/http";
import { deleteTransaction, getTransaction, updateTransaction } from "@/lib/finance/service";
import { parseInput, transactionPatch } from "@/lib/finance/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  return respond(async () => {
    const { id } = await params;
    return getTransaction(id);
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  return respond(async () => {
    const { id } = await params;
    await updateTransaction(id, parseInput(transactionPatch, await readJson(request)));
  });
}

/** ?scope=one (padrão) | group (todas as parcelas) | future (este e os próximos da recorrência). */
export async function DELETE(request: Request, { params }: Ctx) {
  return respond(async () => {
    const { id } = await params;
    const scope = new URL(request.url).searchParams.get("scope");
    await deleteTransaction(id, scope === "group" || scope === "future" ? scope : "one");
  });
}
