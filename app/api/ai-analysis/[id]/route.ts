import { NextResponse } from "next/server";
import { z } from "zod";
import { analysisApiFailure, analysisApiUser } from "@/lib/ai/api";
import { deleteGoldAnalysis, getGoldAnalysisById } from "@/lib/data/gold-analyses";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await analysisApiUser();
    if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ success: false, error: "Invalid analysis ID" }, { status: 400 });
    const analysis = await getGoldAnalysisById(user.id, id);
    return NextResponse.json(analysis ? { success: true, data: analysis } : { success: false, error: "Analysis not found" }, { status: analysis ? 200 : 404, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return analysisApiFailure(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await analysisApiUser();
    if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ success: false, error: "Invalid analysis ID" }, { status: 400 });
    const deleted = await deleteGoldAnalysis(user.id, id);
    return NextResponse.json(deleted ? { success: true, data: deleted } : { success: false, error: "Analysis not found" }, { status: deleted ? 200 : 404, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return analysisApiFailure(error); }
}
