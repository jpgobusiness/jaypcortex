import { readJson, respond } from "@/lib/finance/http";
import { deleteRecurrence, getRecurrence, updateRecurrence } from "@/lib/finance/service";
import { parseInput, recurrencePatch } from "@/lib/finance/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  return respond(async () => getRecurrence((await params).id));
}

/** Muda a regra. Com `months`, atualiza o valor de cada mês (passado e futuro). */
export async function PATCH(request: Request, { params }: Ctx) {
  return respond(async () => {
    const { id } = await params;
    await updateRecurrence(id, parseInput(recurrencePatch, await readJson(request)));
  });
}

/** ?scope=future (padrão: encerra e apaga os próximos) | all (apaga também o histórico). */
export async function DELETE(request: Request, { params }: Ctx) {
  return respond(async () => {
    const { id } = await params;
    const scope = new URL(request.url).searchParams.get("scope") === "all" ? "all" : "future";
    await deleteRecurrence(id, scope);
  });
}
