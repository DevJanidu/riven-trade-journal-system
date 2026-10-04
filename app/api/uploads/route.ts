import { randomUUID } from "node:crypto";
import { failure, success } from "@/lib/api/response";
import { MAX_SCREENSHOT_BYTES, screenshotTypes, storeScreenshot } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let form: FormData;
  try { form = await request.formData(); } catch { return failure("Request must contain multipart form data", 400); }
  const file = form.get("file");
  if (!(file instanceof File)) return failure("Select an image to upload", 400);
  const extension = screenshotTypes[file.type as keyof typeof screenshotTypes];
  if (!extension) return failure("Use a PNG, JPEG, or WebP image", 400);
  if (file.size === 0 || file.size > MAX_SCREENSHOT_BYTES) return failure("Images must be between 1 byte and 8 MB", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const signatureMatches = file.type === "image/png"
    ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
    : file.type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80;
  if (!signatureMatches) return failure("The selected file is not a valid PNG, JPEG, or WebP image", 400);

  const key = `trades/${randomUUID()}/${randomUUID()}.${extension}`;
  try {
    await storeScreenshot(key, bytes, file.type);
    return success({ key }, 201);
  } catch (error) {
    console.error("Image upload failed", error);
    return failure("Image storage is unavailable. Check the server storage configuration.", 503);
  }
}
