import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { completeDraft, getDraftById } from "@/lib/data/drafts";
import { failure, handleApiError, success, validationFailure } from "@/lib/api/response";
import { removeScreenshot, screenshotBelongsToUser, screenshotReferencesBelongToUser } from "@/lib/storage";
import { requireUserId } from "@/lib/auth/session";
import { createTradeSchema, tradeIdSchema } from "@/lib/validations/trade";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  if (!tradeIdSchema.safeParse(id).success) return failure("Invalid draft ID", 400);
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Request body must be valid JSON", 400); }
  const parsed = createTradeSchema.safeParse(body);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const userId = await requireUserId();
    if (!await screenshotReferencesBelongToUser([parsed.data.beforeScreenshot, parsed.data.afterScreenshot], userId)) return failure("Screenshot does not belong to this account", 403);
    const previous = await getDraftById(id);
    if (!previous) return failure("Draft not found", 404);
    const trade = await completeDraft(id, parsed.data);
    if (!trade) return failure("Draft not found", 404);
    const obsolete = [previous.data.beforeScreenshot, previous.data.afterScreenshot]
      .filter((key): key is string => Boolean(key && screenshotBelongsToUser(key, userId) && key !== trade.beforeScreenshot && key !== trade.afterScreenshot));
    if (obsolete.length) after(async () => {
      await Promise.all(obsolete.map(key => removeScreenshot(key).catch(error => console.error("Unable to remove replaced draft screenshot", error))));
    });
    revalidatePath("/trades");
    revalidatePath("/dashboard");
    return success(trade, 201);
  } catch (error) { return handleApiError(error, "complete draft"); }
}
