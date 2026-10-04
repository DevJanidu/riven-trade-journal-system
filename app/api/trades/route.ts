import { revalidatePath } from "next/cache";
import { createTrade, getTrades } from "@/lib/data/trades";
import { failure, handleApiError, queryObject, success, validationFailure } from "@/lib/api/response";
import { createTradeSchema, tradeQuerySchema } from "@/lib/validations/trade";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = queryObject(new URL(request.url).searchParams);
  if (!query) return failure("Duplicate query parameters are not allowed", 400);
  const parsed = tradeQuerySchema.safeParse(query);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    return success(await getTrades(parsed.data));
  } catch (error) {
    return handleApiError(error, "load trades");
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Request body must be valid JSON", 400); }
  const parsed = createTradeSchema.safeParse(body);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const trade = await createTrade(parsed.data);
    revalidatePath("/dashboard");
    revalidatePath("/trades");
    return success(trade, 201);
  } catch (error) {
    return handleApiError(error, "create trade");
  }
}
