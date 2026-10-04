import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DatabaseConfigurationError } from "@/lib/db";

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true as const, data }, { status });
}

export function failure(error: string, status: number, fieldErrors?: Record<string, string[]>) {
  return NextResponse.json({ success: false as const, error, ...(fieldErrors ? { fieldErrors } : {}) }, { status });
}

export function validationFailure(error: ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return failure("Please correct the highlighted fields", 422, fieldErrors);
}

export function handleApiError(error: unknown, action: string) {
  if (error instanceof ZodError) return validationFailure(error);
  if (error instanceof DatabaseConfigurationError) return failure("Database is not configured", 503);
  const message = error instanceof Error ? error.message : String(error);
  if (/relation .*trades.* does not exist|table .*trades.* does not exist/i.test(message)) {
    console.error(`[api] ${action}: database schema is missing`, error);
    return failure("Database schema is not initialized. Run npm.cmd run db:migrate against this database.", 503);
  }
  console.error(`[api] ${action}`, error);
  return failure(`Unable to ${action}`, 500);
}

export function queryObject(searchParams: URLSearchParams) {
  const seen = new Set<string>();
  for (const key of searchParams.keys()) {
    if (seen.has(key)) return null;
    seen.add(key);
  }
  return Object.fromEntries(searchParams.entries());
}
