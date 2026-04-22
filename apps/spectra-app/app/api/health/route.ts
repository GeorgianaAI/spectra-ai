/**
 * GET /api/health
 *
 * Used by scripts/verify-ready.mjs and UptimeRobot.
 * Probes the two dependencies owned by spectra-app:
 *   - Supabase  (auth + job records)
 *   - Upstash Redis  (rate limiting)
 *
 * LangSmith and Upstash Vector are Lambda-side concerns — not checked here.
 *
 * Returns 200 { status: "ok" }  when all critical deps are healthy.
 * Returns 503 { status: "degraded" } in production when any critical dep fails.
 */

import { NextResponse } from "next/server";
import { probeSupabase, probeRedis } from "@/lib/health-probes";

type HealthState = "ok" | "missing" | "error";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function GET(req: Request) {
  const reqId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  const [supabase, redis] = await Promise.all<{ state: HealthState; detail?: string }>([
    supabaseUrl && supabaseKey
      ? probeSupabase(supabaseUrl, supabaseKey)
      : Promise.resolve({ state: "missing" }),
    redisUrl && redisToken
      ? probeRedis(redisUrl, redisToken)
      : Promise.resolve({ state: "missing" }),
  ]);

  const dependencies = { supabase: supabase.state, redis: redis.state };
  const details: Record<string, string> = {};
  if (supabase.detail) details.supabase = supabase.detail;
  if (redis.detail) details.redis = redis.detail;

  const criticalFailure =
    isProduction() &&
    (supabase.state === "error" ||
      supabase.state === "missing" ||
      redis.state === "error" ||
      redis.state === "missing");

  const httpStatus = criticalFailure ? 503 : 200;

  if (httpStatus !== 200) {
    console.error(
      JSON.stringify({
        component: "spectra.api.health",
        reqId,
        level: "error",
        event: "production_health_degraded",
        dependencies,
      }),
    );
  } else if (supabase.state !== "ok" || redis.state !== "ok") {
    console.warn(
      JSON.stringify({
        component: "spectra.api.health",
        reqId,
        level: "warn",
        event: "non_production_health_degraded",
        dependencies,
      }),
    );
  }

  return NextResponse.json(
    {
      status: httpStatus === 200 ? "ok" : "degraded",
      env: isProduction() ? "production" : "non-production",
      dependencies,
      ...(Object.keys(details).length > 0 && { details }),
    },
    { status: httpStatus, headers: { "cache-control": "no-store", "x-request-id": reqId } },
  );
}
