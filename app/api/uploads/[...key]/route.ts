import { failure } from "@/lib/api/response";
import { isScreenshotKey, readScreenshot, removeScreenshot } from "@/lib/storage";

export const runtime = "nodejs";
type Context = { params: Promise<{ key: string[] }> };

async function getKey(context: Context) {
  const { key } = await context.params;
  const value = key.join("/");
  return isScreenshotKey(value) ? value : null;
}

export async function GET(_request: Request, context: Context) {
  const key = await getKey(context);
  if (!key) return failure("Invalid image key", 400);
  try {
    const image = await readScreenshot(key);
    return new Response(image.body, { headers: { "Content-Type": image.contentType, "Cache-Control": "private, max-age=60", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof Error && error.name === "NotFound") return failure("Image not found", 404);
    return failure("Image storage is unavailable", 503);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const key = await getKey(context);
  if (!key) return failure("Invalid image key", 400);
  try {
    await removeScreenshot(key);
    return new Response(null, { status: 204 });
  } catch {
    return failure("Unable to remove image from storage", 503);
  }
}
