import { NextResponse } from "next/server";
import { z } from "zod";
import { analysisApiFailure, analysisApiUser } from "@/lib/ai/api";
import { getAnalysisHistory } from "@/lib/data/gold-analyses";
export async function GET(request: Request) {
  try {
    const user = await analysisApiUser();
    if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    const parsed = z.coerce.number().int().min(0).max(100000).safeParse(new URL(request.url).searchParams.get("offset") ?? 0);
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid history offset" }, { status: 400 });
    return NextResponse.json({ success: true, data: await getAnalysisHistory(user.id, parsed.data) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return analysisApiFailure(error); }
}
