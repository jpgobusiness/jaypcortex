import { readJson, respond } from "@/lib/finance/http";
import { deleteAccount, updateAccount } from "@/lib/finance/service";
import { accountPatch, parseInput } from "@/lib/finance/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Edita a conta. Com `balanceCents`, ajusta o saldo para bater com o banco. */
export async function PATCH(request: Request, { params }: Ctx) {
  return respond(async () => {
    const { id } = await params;
    await updateAccount(id, parseInput(accountPatch, await readJson(request)));
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return respond(async () => deleteAccount((await params).id));
}
