import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { deleteDraft, getDraftById, updateDraft } from "@/lib/data/drafts";
import { failure, handleApiError, success, validationFailure } from "@/lib/api/response";
import { isScreenshotKey, removeScreenshot } from "@/lib/storage";
import { draftSchema } from "@/lib/validations/draft";
import { tradeIdSchema } from "@/lib/validations/trade";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!tradeIdSchema.safeParse(id).success) return failure("Invalid draft ID", 400);
  try {
    const draft = await getDraftById(id);
    return draft ? success(draft) : failure("Draft not found", 404);
  } catch (error) { return handleApiError(error, "load draft"); }
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!tradeIdSchema.safeParse(id).success) return failure("Invalid draft ID", 400);
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Request body must be valid JSON", 400); }
  const parsed = draftSchema.safeParse(body);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const previous = await getDraftById(id);
    if (!previous) return failure("Draft not found", 404);
    const draft = await updateDraft(id, parsed.data);
    if (!draft) return failure("Draft not found", 404);
    const obsolete = [previous.data.beforeScreenshot, previous.data.afterScreenshot]
      .filter((key): key is string => Boolean(key && isScreenshotKey(key) && key !== draft.data.beforeScreenshot && key !== draft.data.afterScreenshot));
    if (obsolete.length) after(async () => {
      await Promise.all(obsolete.map(key => removeScreenshot(key).catch(error => console.error("Unable to remove replaced draft screenshot", error))));
    });
    revalidatePath("/trades");
    return success(draft);
  } catch (error) { return handleApiError(error, "update draft"); }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!tradeIdSchema.safeParse(id).success) return failure("Invalid draft ID", 400);
  try {
    const draft = await getDraftById(id);
    if (!draft) return failure("Draft not found", 404);
    await deleteDraft(id);
    const keys = [draft.data.beforeScreenshot, draft.data.afterScreenshot].filter((key): key is string => Boolean(key && isScreenshotKey(key)));
    if (keys.length) after(async () => {
      await Promise.all(keys.map(key => removeScreenshot(key).catch(error => console.error("Unable to remove deleted draft screenshot", error))));
    });
    revalidatePath("/trades");
    return success({ id });
  } catch (error) { return handleApiError(error, "delete draft"); }
}
