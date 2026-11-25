import "dotenv/config";
import { prisma } from "../lib/prisma";
import { ensureDefaultGroups } from "../lib/activities/groups";

async function main() {
  const admin = await prisma.profile.findFirst({
    where: { role: "admin", active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  const rows = await ensureDefaultGroups(admin?.id ?? null);
  console.log(
    `grupos: ${rows.map((row) => row.name).join(", ")}` +
      (admin ? ` (dono ${admin.email})` : " (sem perfil admin; ownerId nulo)")
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
