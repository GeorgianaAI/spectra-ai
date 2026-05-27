import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { issueJwt, verifyJwt } from "@/lib/jwt";
import { logAuthEvent } from "@/lib/authLogger";
import { getClientIp } from "@/lib/apiHelpers";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "rl:auth:refresh",
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    logAuthEvent({ type: "refresh_rate_limited", ip });
    return NextResponse.json(
      { error: "Too many refresh attempts — slow down", code: "RATE_LIMITED" },
      { status: 429 },
    );
  }

  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing token", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let sub: string;
  let email: string;
  try {
    const claims = await verifyJwt(auth.slice(7));
    sub = claims.sub;
    email = claims.email;
  } catch {
    logAuthEvent({ type: "refresh_invalid_token", ip });
    return NextResponse.json(
      { error: "Invalid or expired token", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const token = await issueJwt(sub, email);
  logAuthEvent({ type: "refresh_success", ip });
  return NextResponse.json({ token });
}
