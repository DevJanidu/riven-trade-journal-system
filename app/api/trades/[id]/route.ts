import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { deleteTrade, getTradeById, updateTrade } from "@/lib/data/trades";
import { failure, handleApiError, success, validationFailure } from "@/lib/api/response";
import { tradeIdSchema, updateTradeSchema } from "@/lib/validations/trade";
import { isScreenshotKey, removeScreenshot } from "@/lib/storage";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!tradeIdSchema.safeParse(id).success) return failure("Invalid trade ID", 400);
  try {
    const trade = await getTradeById(id);
    return trade ? success(trade) : failure("Trade not found", 404);
  } catch (error) {
    return handleApiError(error, "load trade");
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!tradeIdSchema.safeParse(id).success) return failure("Invalid trade ID", 400);
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Request body must be valid JSON", 400); }
  const parsed = updateTradeSchema.safeParse(body);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const imageChanged = Object.hasOwn(parsed.data, "beforeScreenshot") || Object.hasOwn(parsed.data, "afterScreenshot");
    const previous = imageChanged ? await getTradeById(id) : undefined;
    if (imageChanged && !previous) return failure("Trade not found", 404);
    const trade = await updateTrade(id, parsed.data, previous);
    if (!trade) return failure("Trade not found", 404);
    const obsolete = previous ? [previous.beforeScreenshot, previous.afterScreenshot].filter((key): key is string => Boolean(key && isScreenshotKey(key) && key !== trade.beforeScreenshot && key !== trade.afterScreenshot)) : [];
    if (obsolete.length) after(async () => {
      await Promise.all(obsolete.map(key => removeScreenshot(key).catch(error => console.error("Unable to remove replaced screenshot", error))));
    });
    revalidatePath("/dashboard");
    revalidatePath("/trades");
    revalidatePath(`/trades/${id}`);
    return success(trade);
  } catch (error) {
    return handleApiError(error, "update trade");
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!tradeIdSchema.safeParse(id).success) return failure("Invalid trade ID", 400);
  try {
    const trade = await getTradeById(id);
    if (!trade) return failure("Trade not found", 404);
    const removed = await deleteTrade(id);
    if (!removed) return failure("Trade not found", 404);
    const images = [trade.beforeScreenshot, trade.afterScreenshot].filter((key): key is string => Boolean(key && isScreenshotKey(key)));
    await Promise.all(images.map(key => removeScreenshot(key).catch(error => console.error("Unable to remove deleted trade screenshot", error))));
    revalidatePath("/dashboard");
    revalidatePath("/trades");
    revalidatePath(`/trades/${id}`);
    return success({ id });
  } catch (error) {
    return handleApiError(error, "delete trade");
  }
}
