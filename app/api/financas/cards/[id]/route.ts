import { readJson, respond } from "@/lib/finance/http";
import { deleteCard, getCard, updateCard } from "@/lib/finance/service";
import { cardPatch, parseInput } from "@/lib/finance/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Cartão com todas as faturas (passadas, aberta e futuras). */
export async function GET(_request: Request, { params }: Ctx) {
  return respond(async () => getCard((await params).id));
}

export async function PATCH(request: Request, { params }: Ctx) {
  return respond(async () => {
    const { id } = await params;
    await updateCard(id, parseInput(cardPatch, await readJson(request)));
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return respond(async () => deleteCard((await params).id));
}
