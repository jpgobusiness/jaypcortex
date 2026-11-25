import {
  getGroup,
  removeGroup,
  updateGroup,
} from "@/lib/activities/groups";
import {
  handleDeleteGroup,
  handleGetGroup,
  handleUpdateGroup,
  type GroupApi,
} from "@/lib/activities/group-http";
import { requestActor } from "@/lib/activities/actor-http";

const api = {
  get: (id: string, actor: { actorId?: string | null }) => getGroup(id, actor),
  update: updateGroup,
  remove: removeGroup,
} as GroupApi;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleGetGroup(req, id, api, await requestActor());
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleUpdateGroup(req, id, api, await requestActor());
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleDeleteGroup(req, id, api, await requestActor());
}
