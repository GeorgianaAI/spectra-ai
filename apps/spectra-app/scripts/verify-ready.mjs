#!/usr/bin/env node

/**
 * Runtime smoke test for spectra-app.
 * Pings /api/health and verifies Supabase + Upstash Redis connections report ok.
 *
 * Usage:
 *   node scripts/verify-ready.mjs
 *   VERIFY_READY_BASE_URL=https://spectra.vercel.app node scripts/verify-ready.mjs
 *   VERIFY_TARGET_ENV=production node scripts/verify-ready.mjs
 *
 * Requires the dev server (or deployed app) to be running before calling this.
 */

const baseUrl = (process.env.VERIFY_READY_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const isProd = process.env.VERIFY_TARGET_ENV === "production";
const target = isProd ? "production" : "non-production";

function isAcceptable(body) {
  if (isProd) {
    return (
      body?.status === "ok" &&
      body?.dependencies?.supabase === "ok" &&
      body?.dependencies?.redis === "ok"
    );
  }
  // Non-production: tolerate degraded deps but reject hard errors
  return (
    body?.dependencies?.supabase !== "error" &&
    body?.dependencies?.redis !== "error"
  );
}

async function run() {
  let healthRes;
  try {
    healthRes = await fetch(`${baseUrl}/api/health`, {
      headers: { "x-request-id": "verify-ready-health" },
    });
  } catch (err) {
    console.error("[verify-ready] Could not reach /api/health — is the server running?");
    console.error(" ", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const healthBody = await healthRes.json();

  if (!healthRes.ok || !isAcceptable(healthBody)) {
    console.error("[verify-ready] Health check failed", {
      statusCode: healthRes.status,
      status: healthBody?.status,
      dependencies: healthBody?.dependencies,
      target,
    });
    process.exit(1);
  }

  console.log(`[verify-ready] OK (${target}) — Supabase: ${healthBody.dependencies?.supabase}, Redis: ${healthBody.dependencies?.redis}`);
}

run().catch((err) => {
  console.error("[verify-ready] Unexpected error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
