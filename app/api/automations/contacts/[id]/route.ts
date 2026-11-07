import { badRequest, ok, serverError, str } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  isValidWhatsAppPhone,
  normalizeWhatsAppPhone,
  WHATSAPP_AUTOMATION_KEY,
} from "@/lib/whatsapp";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    const current = await prisma.automationContact.findUnique({ where: { id } });
    if (!current || current.automationKey !== WHATSAPP_AUTOMATION_KEY) {
      return badRequest("Contato não encontrado");
    }

    const data: { name?: string; phone?: string } = {};
    if (body.name !== undefined) {
      const name = str(body.name);
      if (!name) return badRequest("Nome do contato é obrigatório");
      data.name = name;
    }
    if (body.phone !== undefined) {
      const phone = str(body.phone);
      if (!phone || !isValidWhatsAppPhone(phone)) {
        return badRequest("Informe um WhatsApp válido com DDD");
      }
      const normalizedPhone = normalizeWhatsAppPhone(phone);
      const duplicate = await prisma.automationContact.findFirst({
        where: {
          automationKey: WHATSAPP_AUTOMATION_KEY,
          phone: normalizedPhone,
          NOT: { id },
        },
      });
      if (duplicate) return badRequest("Este WhatsApp já está cadastrado");
      data.phone = normalizedPhone;
    }

    const contact = await prisma.automationContact.update({
      where: { id },
      data,
    });
    return ok(contact);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await prisma.automationContact.delete({ where: { id } });
    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
