import { revalidatePath } from "next/cache";
import { createDraft, getDrafts } from "@/lib/data/drafts";
import { failure, handleApiError, success, validationFailure } from "@/lib/api/response";
import { draftSchema } from "@/lib/validations/draft";
import { monthSchema } from "@/lib/validations/trade";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const parsed = monthSchema.safeParse(month);
  if (!parsed.success) return validationFailure(parsed.error);
  try { return success(await getDrafts(parsed.data)); }
  catch (error) { return handleApiError(error, "load drafts"); }
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Request body must be valid JSON", 400); }
  const parsed = draftSchema.safeParse(body);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const draft = await createDraft(parsed.data);
    revalidatePath("/trades");
    return success(draft, 201);
  } catch (error) { return handleApiError(error, "save draft"); }
}
