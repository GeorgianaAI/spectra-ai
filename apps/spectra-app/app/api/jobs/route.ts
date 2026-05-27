import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getSupabaseClient } from "@/lib/supabase";
import { getClientIp, requireAuth } from "@/lib/apiHelpers";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "rl:jobs:list",
});

export async function GET(request: NextRequest) {
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

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, status, created_at, completed_at, modalities_used, confidence_scores, error")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch jobs", code: "SERVER_ERROR" },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? []);
}
