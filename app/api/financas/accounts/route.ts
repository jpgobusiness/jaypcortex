import { readJson, respond } from "@/lib/finance/http";
import { createAccount, listAccounts } from "@/lib/finance/service";
import { accountInput, parseInput } from "@/lib/finance/validation";

export async function GET() {
  return respond(() => listAccounts());
}

export async function POST(request: Request) {
  return respond(async () => createAccount(parseInput(accountInput, await readJson(request))), 201);
}
