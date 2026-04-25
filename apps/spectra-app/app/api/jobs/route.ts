import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyJwt } from "@/lib/jwt";

export async function GET(request: NextRequest) {
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

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, status, created_at, completed_at, modalities_used, confidence_scores")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch jobs", code: "SERVER_ERROR" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
