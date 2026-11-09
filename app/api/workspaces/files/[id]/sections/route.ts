import { requireApiUser } from "@/lib/auth";
import { badRequest, conflict, notFound, ok, serverError, str } from "@/lib/api";
import {
  OpportunityConflictError,
  appendToFile,
  deleteDocumentSection,
  getDocumentOutline,
  readDocumentSection,
  upsertDocumentSection,
} from "@/lib/opportunities/service";
import { SectionNotFoundError } from "@/lib/tiptap/sections";

type Ctx = { params: Promise<{ id: string }> };

function mapError(err: unknown) {
  if (err instanceof OpportunityConflictError) {
    return conflict({ error: "conflict", content_hash: err.content_hash });
  }
  if (err instanceof SectionNotFoundError) return notFound(err.message);
  if (err instanceof Error && err.message === "Arquivo não encontrado") return notFound(err.message);
  return serverError(err);
}

/** GET outline; com heading ou section_id, lê a seção. */
export async function GET(req: Request, { params }: Ctx) {
  const { error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const heading = str(url.searchParams.get("heading"));
    const sectionId = str(url.searchParams.get("section_id"));
    if (heading || sectionId) {
      return ok(await readDocumentSection({
        file_id: id,
        heading: heading ?? undefined,
        section_id: sectionId ?? undefined,
      }));
    }
    return ok(await getDocumentOutline(id));
  } catch (e) {
    return mapError(e);
  }
}

/** PUT: upsert da seção. */
export async function PUT(req: Request, { params }: Ctx) {
  const { profile, error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await req.json();
    const heading = str(body.heading);
    if (!heading) return badRequest("Informe heading");
    if (typeof body.markdown !== "string") return badRequest("Informe markdown");
    return ok(await upsertDocumentSection({
      file_id: id,
      heading,
      markdown: body.markdown,
      after_heading: str(body.after_heading) ?? undefined,
      expected_hash: str(body.expected_hash) ?? undefined,
      createdBy: profile.id,
      source: "ui",
    }));
  } catch (e) {
    return mapError(e);
  }
}

/** DELETE: remove a seção. Heading inexistente → not_found; hash divergente → conflict. */
export async function DELETE(req: Request, { params }: Ctx) {
  const { profile, error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    let heading: string | null = null;
    let expectedHash: string | null = null;
    const url = new URL(req.url);
    heading = str(url.searchParams.get("heading"));
    expectedHash = str(url.searchParams.get("expected_hash"));
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      heading = str(body.heading) ?? heading;
      expectedHash = str(body.expected_hash) ?? expectedHash;
    }
    if (!heading) return badRequest("Informe heading");
    return ok(await deleteDocumentSection({
      file_id: id,
      heading,
      expected_hash: expectedHash ?? undefined,
      createdBy: profile.id,
      source: "ui",
    }));
  } catch (e) {
    if (e instanceof SectionNotFoundError) return notFound("not_found");
    return mapError(e);
  }
}

/** POST: append no fim do documento. */
export async function POST(req: Request, { params }: Ctx) {
  const { profile, error } = await requireApiUser();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await req.json();
    if (typeof body.markdown !== "string") return badRequest("Informe markdown");
    return ok(await appendToFile({
      file_id: id,
      markdown: body.markdown,
      expected_hash: str(body.expected_hash) ?? undefined,
      createdBy: profile.id,
      source: "ui",
    }));
  } catch (e) {
    return mapError(e);
  }
}
