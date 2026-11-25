import { readJson, respond } from "@/lib/finance/http";
import { createCard, listCards } from "@/lib/finance/service";
import { cardInput, parseInput } from "@/lib/finance/validation";

export async function GET() {
  return respond(() => listCards());
}

export async function POST(request: Request) {
  return respond(async () => createCard(parseInput(cardInput, await readJson(request))), 201);
}
