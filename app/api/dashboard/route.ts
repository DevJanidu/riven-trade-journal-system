import { getDashboardData } from "@/lib/data/trades";
import { failure, handleApiError, queryObject, success, validationFailure } from "@/lib/api/response";
import { dashboardQuerySchema } from "@/lib/validations/trade";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = queryObject(new URL(request.url).searchParams);
  if (!query) return failure("Duplicate query parameters are not allowed", 400);
  const parsed = dashboardQuerySchema.safeParse(query);
  if (!parsed.success) return validationFailure(parsed.error);
  const month = parsed.data.month ?? new Date().toISOString().slice(0, 7);
  try {
    return success(await getDashboardData(month));
  } catch (error) {
    return handleApiError(error, "load dashboard");
  }
}
