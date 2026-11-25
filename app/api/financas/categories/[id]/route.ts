import { readJson, respond } from "@/lib/finance/http";
import { deleteCategory, updateCategory } from "@/lib/finance/service";
import { categoryPatch, parseInput } from "@/lib/finance/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  return respond(async () => {
    const { id } = await params;
    return updateCategory(id, parseInput(categoryPatch, await readJson(request)));
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return respond(async () => deleteCategory((await params).id));
}
