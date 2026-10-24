import { isUuid } from "@/lib/files";
import { HttpError, publicError } from "@/lib/http";
import { getLibrary } from "@/lib/store";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) throw new HttpError("Unknown document.", 404);
    await getLibrary().deleteDocument(id);
    return Response.json({ ok: true });
  } catch (error) {
    return publicError(error, "The document could not be removed.");
  }
}
