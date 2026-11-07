import { prisma } from "@/lib/prisma";
import { ok, serverError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export async function GET(req: Request) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId");
    const status = url.searchParams.get("status");
    const rows = await prisma.changeProposal.findMany({
      where: {
        ...(agentId ? { agentId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    });
    return ok(rows);
  } catch (e) {
    return serverError(e);
  }
}
