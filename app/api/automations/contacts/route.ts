import { badRequest, ok, serverError, str } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  isValidWhatsAppPhone,
  normalizeWhatsAppPhone,
  WHATSAPP_AUTOMATION_KEY,
} from "@/lib/whatsapp";

export async function GET() {
  try {
    const contacts = await prisma.automationContact.findMany({
      where: { automationKey: WHATSAPP_AUTOMATION_KEY },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    });
    return ok(contacts);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = str(body.name);
    const rawPhone = str(body.phone);
    if (!name) return badRequest("Nome do contato é obrigatório");
    if (!rawPhone || !isValidWhatsAppPhone(rawPhone)) {
      return badRequest("Informe um WhatsApp válido com DDD");
    }

    const phone = normalizeWhatsAppPhone(rawPhone);
    const existing = await prisma.automationContact.findUnique({
      where: {
        automationKey_phone: {
          automationKey: WHATSAPP_AUTOMATION_KEY,
          phone,
        },
      },
    });
    if (existing) return badRequest("Este WhatsApp já está cadastrado");

    const contact = await prisma.automationContact.create({
      data: {
        automationKey: WHATSAPP_AUTOMATION_KEY,
        name,
        phone,
      },
    });
    return ok(contact, 201);
  } catch (error) {
    return serverError(error);
  }
}
