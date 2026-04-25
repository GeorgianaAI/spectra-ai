import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyJwt } from "@/lib/jwt";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing token", code: "UNAUTHORIZED" }, { status: 401 });
  }
  let userId: string;
  try {
    const claims = await verifyJwt(auth.slice(7));
    userId = claims.sub;
  } catch {
    return NextResponse.json({ error: "Invalid token", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, user_id, status, created_at, confidence_scores, governance_trace, modalities_used, completed_at, error, result_url",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Job not found", code: "NOT_FOUND" }, { status: 404 });
  }
  if (data.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  return NextResponse.json(data);
}
