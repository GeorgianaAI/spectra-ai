import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getSupabaseClient } from "@/lib/supabase";
import { getClientIp, requireAuth } from "@/lib/apiHelpers";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "rl:jobs:trace",
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(request);
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests — slow down", code: "RATE_LIMITED" },
      { status: 429 },
    );
  }

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("user_id, governance_trace")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Job not found", code: "NOT_FOUND" }, { status: 404 });
  }
  if (data.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  return NextResponse.json(data.governance_trace ?? []);
}
