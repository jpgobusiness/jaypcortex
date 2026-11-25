import { readJson, respond } from "@/lib/finance/http";
import { createHousingRecurrence, listRecurrences } from "@/lib/finance/service";
import { housingRecurrenceInput, parseInput } from "@/lib/finance/validation";

export async function GET() {
  return respond(() => listRecurrences());
}

/** Cria aluguel ou condomínio com valor por mês, do início até o horizonte. */
export async function POST(request: Request) {
  return respond(async () => createHousingRecurrence(parseInput(housingRecurrenceInput, await readJson(request))), 201);
}
