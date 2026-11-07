import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError, str } from "@/lib/api";
import { findWorkspaceTrees, nextWorkspaceOrder } from "@/lib/workspaces-db";
import {
  DEFAULT_WORKSPACE_COLOR,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_TOO_LONG,
  NAME_MAX_LENGTH,
  NAME_TOO_LONG,
  isHexColor,
} from "@/lib/workspaces";

/** Espaços com pastas e arquivos (sem o conteúdo), para o menu e os dashboards. */
export async function GET() {
  try {
    return ok(await findWorkspaceTrees());
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = str(body.name);
    if (!name) return badRequest("Nome do espaço é obrigatório");
    if (name.length > NAME_MAX_LENGTH) return badRequest(NAME_TOO_LONG);

    const description = str(body.description);
    if (description && description.length > DESCRIPTION_MAX_LENGTH) {
      return badRequest(DESCRIPTION_TOO_LONG);
    }

    if (body.color !== undefined && !isHexColor(body.color)) {
      return badRequest("Cor inválida");
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
        description,
        color: body.color ?? DEFAULT_WORKSPACE_COLOR,
        order: await nextWorkspaceOrder(),
      },
    });
    return ok({ ...workspace, folders: [], files: [] }, 201);
  } catch (e) {
    return serverError(e);
  }
}
