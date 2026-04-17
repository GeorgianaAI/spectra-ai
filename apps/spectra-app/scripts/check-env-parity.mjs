#!/usr/bin/env node

/**
 * Pre-flight env check for spectra-app.
 * Run before `npm run dev` or as part of CI/deployment.
 *
 * Usage:
 *   node scripts/check-env-parity.mjs
 *   VERIFY_TARGET_ENV=production node scripts/check-env-parity.mjs
 */

function hasValue(v) {
  return typeof v === "string" && v.trim().length > 0;
}

const env = process.env;
const isProd = env.VERIFY_TARGET_ENV === "production";
const target = isProd ? "production" : "non-production";
const missing = [];

// ── Auth ──────────────────────────────────────────────────────────────────────
if (!hasValue(env.JWT_SECRET)) missing.push("JWT_SECRET");

// ── Supabase ──────────────────────────────────────────────────────────────────
if (!hasValue(env.NEXT_PUBLIC_SUPABASE_URL))      missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!hasValue(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!hasValue(env.SUPABASE_SERVICE_KEY))          missing.push("SUPABASE_SERVICE_KEY");

// ── Upstash Redis (rate limiting) ─────────────────────────────────────────────
if (!hasValue(env.UPSTASH_REDIS_URL))   missing.push("UPSTASH_REDIS_URL");
if (!hasValue(env.UPSTASH_REDIS_TOKEN)) missing.push("UPSTASH_REDIS_TOKEN");

// ── AWS ───────────────────────────────────────────────────────────────────────
if (!hasValue(env.AWS_REGION))           missing.push("AWS_REGION");
if (!hasValue(env.AWS_ACCESS_KEY_ID))    missing.push("AWS_ACCESS_KEY_ID");
if (!hasValue(env.AWS_SECRET_ACCESS_KEY)) missing.push("AWS_SECRET_ACCESS_KEY");
if (!hasValue(env.AWS_LAMBDA_JOB_PROCESSOR_NAME)) missing.push("AWS_LAMBDA_JOB_PROCESSOR_NAME");

// ── Inngest ───────────────────────────────────────────────────────────────────
if (!hasValue(env.INNGEST_SIGNING_KEY)) missing.push("INNGEST_SIGNING_KEY");
if (!hasValue(env.INNGEST_EVENT_KEY))   missing.push("INNGEST_EVENT_KEY");

// ── Production-only ───────────────────────────────────────────────────────────
if (isProd && !hasValue(env.NEXT_PUBLIC_API_URL)) {
  missing.push("NEXT_PUBLIC_API_URL");
}
if (isProd && !hasValue(env.NEXT_PUBLIC_SENTRY_DSN)) {
  missing.push("NEXT_PUBLIC_SENTRY_DSN");
}

if (missing.length > 0) {
  console.error(`[env-parity] Missing required env vars for ${target}:`);
  for (const name of missing) console.error(`  - ${name}`);
  process.exit(1);
}

console.log(`[env-parity] OK — all required env vars present for ${target}`);
