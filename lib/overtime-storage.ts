import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "overtime-attachments";

export async function createOvertimeAttachmentFile(input: {
  entryId: string;
  name: string;
  mimeType: string;
  size: number;
  bytes: Uint8Array;
}) {
  const created = await prisma.overtimeAttachment.create({
    data: {
      entryId: input.entryId,
      name: input.name,
      mimeType: input.mimeType,
      size: input.size,
      path: "pending",
    },
    select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
  });
  const objectPath = `${input.entryId}/${created.id}/${input.name}`;
  const admin = createSupabaseAdmin();
  const { error } = await admin.storage.from(BUCKET).upload(objectPath, input.bytes, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (error) {
    await prisma.overtimeAttachment.delete({ where: { id: created.id } });
    throw error;
  }
  await prisma.overtimeAttachment.update({
    where: { id: created.id },
    data: { path: objectPath },
  });
  return created;
}

export async function readOvertimeAttachmentFile(id: string) {
  const att = await prisma.overtimeAttachment.findUnique({ where: { id } });
  if (!att) return null;
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.storage.from(BUCKET).download(att.path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  return { ...att, bytes };
}

export async function deleteOvertimeAttachmentFile(id: string) {
  const att = await prisma.overtimeAttachment.findUnique({ where: { id } });
  if (!att) return false;
  const admin = createSupabaseAdmin();
  await admin.storage.from(BUCKET).remove([att.path]);
  await prisma.overtimeAttachment.delete({ where: { id } });
  return true;
}
