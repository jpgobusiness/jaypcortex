import { monthParam, readJson, respond } from "@/lib/finance/http";
import { getInvoice, payInvoice, updateInvoice } from "@/lib/finance/service";
import { invoicePatch, invoicePayment, parseInput } from "@/lib/finance/validation";

type Ctx = { params: Promise<{ id: string; month: string }> };

/** Fatura com as compras e os pagamentos. */
export async function GET(_request: Request, { params }: Ctx) {
  return respond(async () => {
    const { id, month } = await params;
    return getInvoice(id, monthParam(month, "Fatura"));
  });
}

/** Datas reais do banco (fechamento/vencimento) e observação da fatura. */
export async function PATCH(request: Request, { params }: Ctx) {
  return respond(async () => {
    const { id, month } = await params;
    await updateInvoice(id, monthParam(month, "Fatura"), parseInput(invoicePatch, await readJson(request)));
  });
}

/** Registra um pagamento (total ou parcial) da fatura. */
export async function POST(request: Request, { params }: Ctx) {
  return respond(async () => {
    const { id, month } = await params;
    return payInvoice(id, monthParam(month, "Fatura"), parseInput(invoicePayment, await readJson(request)));
  }, 201);
}
