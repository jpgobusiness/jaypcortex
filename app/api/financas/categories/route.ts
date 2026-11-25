import { readJson, respond } from "@/lib/finance/http";
import { createCategory, listCategories } from "@/lib/finance/service";
import { categoryInput, parseInput } from "@/lib/finance/validation";

export async function GET() {
  return respond(() => listCategories());
}

export async function POST(request: Request) {
  return respond(async () => createCategory(parseInput(categoryInput, await readJson(request))), 201);
}
