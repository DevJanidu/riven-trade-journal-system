import { revalidatePath } from "next/cache";
import { deleteSetupType, getSetupType, updateSetupType } from "@/lib/data/setup-types";
import { failure, handleApiError, success, validationFailure } from "@/lib/api/response";
import { createSetupSchema, setupIdSchema } from "@/lib/validations/setup";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function idOf(context: Context) { const { id } = await context.params; return setupIdSchema.safeParse(id).success ? id : null; }
export async function GET(_request: Request, context: Context) { const id = await idOf(context); if (!id) return failure("Invalid setup ID", 400); try { const setup = await getSetupType(id); return setup ? success(setup) : failure("Setup type not found", 404); } catch (error) { return handleApiError(error, "load setup type"); } }
export async function PATCH(request: Request, context: Context) { const id = await idOf(context); if (!id) return failure("Invalid setup ID", 400); let body: unknown; try { body = await request.json(); } catch { return failure("Request body must be valid JSON", 400); } const parsed = createSetupSchema.safeParse(body); if (!parsed.success) return validationFailure(parsed.error); try { const setup = await updateSetupType(id, parsed.data.name, parsed.data.rules, parsed.data.avoidRules); if (!setup) return failure("Setup type not found", 404); revalidatePath("/journal"); revalidatePath("/settings/setups"); return success(setup); } catch (error) { return handleApiError(error, "update setup type"); } }
export async function DELETE(_request: Request, context: Context) { const id = await idOf(context); if (!id) return failure("Invalid setup ID", 400); try { const result = await deleteSetupType(id); if (result.inUse) return failure("This setup is used by trades and cannot be deleted", 409); if (!result.deleted) return failure("Setup type not found", 404); revalidatePath("/journal"); revalidatePath("/settings/setups"); return success({ id }); } catch (error) { return handleApiError(error, "delete setup type"); } }
