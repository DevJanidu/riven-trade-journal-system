import { NextResponse } from "next/server";
import { analysisApiFailure, analysisApiUser } from "@/lib/ai/api";
import { generateGoldAnalysis } from "@/lib/ai/generate";
import { generateAnalysisSchema } from "@/lib/ai/schemas";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    const user = await analysisApiUser();
    if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
    const text = await request.text();
    if (text.length > 8000) return NextResponse.json({ success: false, error: "Request is too large" }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(text); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }
    const parsed = generateAnalysisSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid generation request" }, { status: 422 });
    return NextResponse.json({ success: true, data: await generateGoldAnalysis(user.id) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return analysisApiFailure(error); }
}
