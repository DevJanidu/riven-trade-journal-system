import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { AnalysisCooldownError } from "@/lib/data/gold-analyses";

export async function analysisApiUser() { return getSessionUser(); }
export function analysisApiFailure(error: unknown) {
  if (error instanceof AnalysisCooldownError) return NextResponse.json({ success: false, error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
  const message = error instanceof Error ? error.message : "";
  const safeMessages = ["OpenAI is not configured.", "OpenAI analysis could not be generated", "Insufficient current Gold", "Analysis could not be saved."];
  const safe = safeMessages.some(prefix => message.startsWith(prefix)) ? message : "Unable to generate or load the analysis. Check server configuration and try again later.";
  // Do not log provider objects or SQL errors, which may contain credential-bearing URLs.
  console.error("[ai-analysis] operation failed", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ success: false, error: safe }, { status: 503 });
}
