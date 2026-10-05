import { getSessionUser } from "@/lib/auth/session";
import { getCalendarData } from "@/lib/data/calendar";
import { failure, handleApiError, queryObject, success, validationFailure } from "@/lib/api/response";
import { dashboardQuerySchema } from "@/lib/validations/trade";
import { monthKey } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!await getSessionUser()) return failure("Authentication required", 401);
    const query = queryObject(new URL(request.url).searchParams);
    if (!query) return failure("Duplicate query parameters are not allowed", 400);
    const parsed = dashboardQuerySchema.safeParse(query);
    if (!parsed.success) return validationFailure(parsed.error);
    const response = success(await getCalendarData(parsed.data.month ?? monthKey(new Date())));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return handleApiError(error, "load calendar");
  }
}
