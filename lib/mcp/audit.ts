import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma-postgres/client";

export async function writeAudit(opts: {
  actorId?: string | null;
  actorType: "user" | "mcp";
  tokenId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: opts.actorId ?? null,
      actorType: opts.actorType,
      tokenId: opts.tokenId || null,
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId ?? null,
      meta: opts.meta,
    },
  });
}
