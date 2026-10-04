import { revalidatePath } from "next/cache";
import { createSetupType, listSetupTypes } from "@/lib/data/setup-types";
import { failure, handleApiError, success, validationFailure } from "@/lib/api/response";
import { createSetupSchema } from "@/lib/validations/setup";

export const runtime = "nodejs";
export async function GET() { try { return success(await listSetupTypes()); } catch (error) { return handleApiError(error, "load setup types"); } }
export async function POST(request: Request) {
  let body: unknown; try { body = await request.json(); } catch { return failure("Request body must be valid JSON", 400); }
  const parsed = createSetupSchema.safeParse(body); if (!parsed.success) return validationFailure(parsed.error);
  try { const setup = await createSetupType(parsed.data.name, parsed.data.rules, parsed.data.avoidRules); revalidatePath("/journal"); revalidatePath("/settings/setups"); return success(setup, 201); }
  catch (error) { return handleApiError(error, "create setup type"); }
}
