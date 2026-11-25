import {
  addActivitiesToGroup,
  listGroupActivities,
  removeActivitiesFromGroup,
} from "@/lib/activities/groups";
import {
  handleAddGroupActivities,
  handleListGroupActivities,
  handleRemoveGroupActivities,
  type GroupApi,
} from "@/lib/activities/group-http";
import { requestActor } from "@/lib/activities/actor-http";

const api = {
  listActivities: listGroupActivities,
  add: addActivitiesToGroup,
  removeActivities: removeActivitiesFromGroup,
} as GroupApi;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleListGroupActivities(req, id, api, await requestActor());
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleAddGroupActivities(req, id, api, await requestActor());
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleRemoveGroupActivities(req, id, api, await requestActor());
}
