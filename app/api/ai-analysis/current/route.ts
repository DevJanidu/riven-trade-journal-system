import { NextResponse } from "next/server";
import { analysisApiFailure, analysisApiUser } from "@/lib/ai/api";
import { getCurrentGoldAnalysis } from "@/lib/data/gold-analyses";
export async function GET() {
  try {
    const user = await analysisApiUser();
    if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    return NextResponse.json({ success: true, data: await getCurrentGoldAnalysis(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return analysisApiFailure(error); }
}
