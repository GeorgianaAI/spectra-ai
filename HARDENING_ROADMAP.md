# Spectra AI — Hardening Roadmap

Post-launch checklist for moving Spectra from portfolio-demo to production-ready. Items are ordered by risk impact, not implementation complexity. None of these block the demo — they are deliberate deferrals.

---

## 1. Lambda Concurrency Cap

**Current state:** `reservedConcurrentExecutions` removed at deploy — new AWS accounts cannot reserve below 10 unreserved concurrency.

**Action:** Request a Lambda concurrent executions limit increase via AWS Service Quotas (minimum: raise regional limit to 20+). Once approved, restore `reservedConcurrentExecutions: 1` in `compute-stack.ts` and redeploy.

**Risk without it:** A burst of uploads could run parallel LangGraph pipelines, stacking Bedrock + OpenAI + Anthropic costs. Rate limiter (3 req/day/IP) is the current mitigating guard.

---

## 2. CORS Origin Locking

**Current state:** S3 bucket CORS allows `https://*.vercel.app` and `http://localhost:3000`.

**Action:** After assigning a custom domain to the Vercel deployment, update `storage-stack.ts` to allow only that domain. Remove the wildcard `*.vercel.app` entry.

---

## 3. JWT Token Expiry + Refresh

**Current state:** Tokens are issued without expiry (`/api/auth/token`). A stolen token is valid indefinitely.

**Action:** Add `expiresIn: "8h"` to the JWT sign call. Implement a `/api/auth/refresh` route that accepts a short-lived token and issues a new one. Store refresh tokens in Supabase with revocation support.

---

## 4. PII Redaction Coverage Audit

**Current state:** Regex patterns cover email, phone, SSN, credit card, and full-name heuristics.

**Action:** Run the redaction against a wider corpus of real documents to identify gaps. Consider replacing regex with a dedicated NER model (e.g. spaCy or AWS Comprehend) for higher recall. Audit that `redactedFields` in the Document node output accurately reflects everything removed.

---

## 5. S3 Bucket Policy + Signed URLs

**Current state:** Files are uploaded directly from the Vercel serverless function using service credentials. The Lambda reads files using the same bucket via IAM role.

**Action:** For user-facing uploads at scale, replace server-side `PutObjectCommand` with pre-signed S3 URLs — the browser uploads directly to S3, reducing Vercel function memory pressure and egress cost. The API route generates the signed URL; the browser uses it once.

---

## 6. Sentry Source Maps

**Current state:** `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are not configured. Stack traces in Sentry show minified code.

**Action:** Create a Sentry internal integration, generate `SENTRY_AUTH_TOKEN`, and add all three vars to Vercel env vars. Source map upload is already gated on `NODE_ENV === "production"` in `next.config.ts`.

---

## 7. Upstash Vector Cleanup on Job Failure

**Current state:** Document chunks are deleted from Upstash Vector on job completion. If a job fails mid-pipeline, vectors from a partial `documentNode` run may be orphaned.

**Action:** Add a cleanup step in `failJob()` that deletes any vectors under `{jobId}/{userId}/` regardless of pipeline completion state. This prevents unbounded vector index growth from failed runs.

---

## 8. Lambda Cold Start Mitigation

**Current state:** `jobProcessor` cold start adds 3–5s to the first invocation after idle.

**Action:** Enable Lambda Provisioned Concurrency (1 instance) during peak demo hours, or add a scheduled CloudWatch Event that pings the function every 5 minutes to keep it warm. Evaluate cost vs. latency tradeoff — at portfolio scale, the 5-minute ping is sufficient.

---

## 9. CloudWatch Log Metric Filters

**Current state:** CloudWatch logs exist for both Lambdas but no structured alerting on error patterns.

**Action:** Add `MetricFilter` constructs in `ObservabilityStack` for `[ERROR]` log patterns on both functions. Wire alarms to the existing `billingAlertTopic` SNS topic (or a separate ops topic). This gives runtime error alerting without Sentry on the Lambda side.

---

## 10. Rate Limit Scope

**Current state:** Rate limit applies per IP at `/api/upload` only.

**Action:** Consider rate limiting `/api/auth/token` separately (e.g. 10 attempts per hour per IP) to prevent credential stuffing against the demo account. Upstash sliding window is already in place — it is a one-line addition.

---

## Update Rules

Add entries when a known limitation is accepted at demo-scale that would need to be resolved before a production launch. Remove or mark `[RESOLVED]` when addressed.
