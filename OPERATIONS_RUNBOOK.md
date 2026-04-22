# 📘 Spectra AI — Operations Runbook

Operational reference for Spectra AI. Covers health semantics, common failure modes across all runtime dependencies, CDK deployment, and rollback guidance.

---

## Health Endpoint Semantics

`GET /api/health` is served by spectra-app (Vercel).

| Environment    | Dependency state                    | Response                     |
| :------------- | :---------------------------------- | :--------------------------- |
| Non-production | All probes OK                       | `200 { status: "ok" }`       |
| Non-production | Any probe missing/error             | `200 { status: "degraded" }` |
| Production     | All probes OK                       | `200 { status: "ok" }`       |
| Production     | `supabase` or `redis` missing/error | `503 { status: "degraded" }` |

**Dependency probe states:**

- `ok` — probe succeeded within timeout
- `missing` — required env var not present in this deployment
- `error` — probe executed but returned an error or timed out

Responses include a structured JSON body with per-dependency states and an `x-request-id` header for log correlation.

---

## Lambda Health

Two Lambda functions in `eu-west-1`:

| Function                 | Trigger                                          | Purpose                                        |
| :----------------------- | :----------------------------------------------- | :--------------------------------------------- |
| `spectra-ingest-handler` | S3 `ObjectCreated` on `spectra-uploads/uploads/` | Validates upload metadata, fires Inngest event |
| `spectra-job-processor`  | Inngest HTTP invocation                          | Runs full LangGraph agent pipeline             |

`spectra-job-processor` is kept warm by a CloudWatch Events rule (`spectra-jobprocessor-warmup`) firing every 5 minutes. Cold start latency is 3–5s without it.

**Lambda error alarms** — CloudWatch MetricFilters watch both log groups for `[ERROR]`/`ERROR`/`Unhandled` patterns and alarm to the `spectra-billing-alerts` SNS topic (email notification).

---

## Common Failure Modes

### S3 — `spectra-uploads`

| Symptom                                 | Likely cause                                                        | Remediation                                                                   |
| :-------------------------------------- | :------------------------------------------------------------------ | :---------------------------------------------------------------------------- |
| Upload presign returns 500              | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` missing in Vercel env | Add to Vercel → Settings → Environment Variables                              |
| Browser S3 PUT fails with CORS error    | CORS origin not in allowed list (production domain changed)         | Update `PRODUCTION_ORIGIN` env var and run `cdk:deploy`                       |
| `ingestHandler` not firing after upload | S3 event notification not wired or Lambda permission missing        | Run `cdk:diff` and `cdk:deploy`; check Lambda resource policy in AWS console  |
| Uploads accumulating past 30 days       | Lifecycle rule not applied                                          | Verify `archive-and-expire` rule in S3 console → Management → Lifecycle rules |

### Upstash Redis

| Symptom                                   | Likely cause                                                   | Remediation                                                                                   |
| :---------------------------------------- | :------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| `429` on all requests despite low traffic | Upstash free-tier daily command limit reached                  | Check Upstash dashboard → usage; upgrade plan or wait for reset                               |
| Health probe returns `redis: error`       | `UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN` missing or rotated | Update env vars in Vercel and Lambda (CDK deploy)                                             |
| LangGraph checkpointing failing           | Redis connection error mid-pipeline                            | Lambda will retry via Inngest; check CloudWatch logs for `[ERROR]` in `spectra-job-processor` |

### Upstash Vector

| Symptom                             | Likely cause                                                      | Remediation                                                                                |
| :---------------------------------- | :---------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| Document Agent returns no citations | `UPSTASH_VECTOR_URL` / `UPSTASH_VECTOR_TOKEN` missing             | Add to Lambda env vars and redeploy                                                        |
| Vector index growing unexpectedly   | `failJob()` cleanup not running (job failing before cleanup step) | Check CloudWatch logs; vector cleanup runs on both success and failure paths since Phase 8 |
| Retrieval returns irrelevant chunks | Deduplication threshold too aggressive or embedding model changed | Review `DEDUP_THRESHOLD` in `documentNode.ts`; run `retrieval-eval.test.ts`                |

### Supabase

| Symptom                                | Likely cause                                               | Remediation                                                                           |
| :------------------------------------- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| Jobs not persisting                    | `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` missing or expired | Rotate key in Supabase dashboard → Settings → API; update env vars                    |
| `401` on job fetch                     | RLS policy rejecting the request                           | Verify `SUPABASE_SERVICE_KEY` is used (not anon key) in Lambda and server-side routes |
| Health probe returns `supabase: error` | Network timeout or Supabase regional incident              | Check [status.supabase.com](https://status.supabase.com); retry after outage clears   |
| Demo account locked                    | Too many failed sign-in attempts                           | Reset in Supabase Auth dashboard → Users → demo@spectra.app                           |

### Inngest

| Symptom                                | Likely cause                                              | Remediation                                                                                                            |
| :------------------------------------- | :-------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| Jobs stuck in `pending`                | `spectra/job.process` event not received by Inngest       | Check Inngest dashboard → Events; verify `INNGEST_EVENT_KEY` in Vercel                                                 |
| `jobProcessor` not invoked             | Inngest app not synced to production URL                  | Re-sync at Inngest dashboard → Apps → spectra-ai-app → Sync manually (`https://spectra-ai-app.vercel.app/api/inngest`) |
| Jobs not retrying on failure           | `INNGEST_SIGNING_KEY` mismatch between Vercel and Inngest | Regenerate signing key in Inngest → Settings and update Vercel env var                                                 |
| Functions missing in Inngest dashboard | Vercel deployment used preview URL instead of production  | Sync with production URL (must be `https://`, not a hashed preview URL)                                                |

### LangSmith

| Symptom                           | Likely cause                                                     | Remediation                                                    |
| :-------------------------------- | :--------------------------------------------------------------- | :------------------------------------------------------------- |
| No traces in LangSmith            | `LANGSMITH_API_KEY` missing or `LANGCHAIN_TRACING_V2` not `true` | Verify in Lambda env vars via CDK deploy                       |
| Traces appearing in wrong project | `LANGSMITH_PROJECT` set to wrong value                           | Update `LANGSMITH_PROJECT=spectra` in Lambda env               |
| LangSmith outage                  | LangSmith service incident                                       | Pipeline continues without tracing — not a blocking dependency |

---

## CDK Deployment

**Standard deploy order:**

```bash
cd apps/spectra-api

# 1. Review changes before applying
npm run cdk:diff

# 2. Deploy all stacks (StorageStack → ComputeStack → ObservabilityStack)
npm run cdk:deploy
```

CDK resolves stack dependency order automatically. All three stacks deploy in a single command.

**Environment variables read at deploy time** (export before running `cdk:deploy`):

```bash
export PRODUCTION_ORIGIN=https://spectra-ai-app.vercel.app  # lock S3 CORS
export LAMBDA_RESERVATION_ENABLED=true                       # only after AWS quota increase approved
export BILLING_ALERT_EMAIL=gchiriac2012@gmail.com           # SNS alarm recipient
```

**After first deploy or stack recreation:**

- Confirm SNS email subscription (AWS sends a confirmation email to `BILLING_ALERT_EMAIL`)
- Verify CloudWatch dashboard at `eu-west-1` → CloudWatch → Dashboards → `spectra-operations`

---

## Immediate Remediation

1. Check `GET /api/health` and capture the `x-request-id` from the response header.
2. Inspect CloudWatch Logs → `/aws/lambda/spectra-job-processor` or `/aws/lambda/spectra-ingest-handler` for structured log events matching the `reqId`.
3. For `missing` dependency state:
   - Verify env vars are present in both Vercel (for spectra-app) and Lambda (via CDK deploy env for spectra-api).
4. For `error` dependency state:
   - Validate upstream service status (Upstash, Supabase, Inngest, LangSmith).
   - Retry after transient outage clears.
5. In production, if `supabase` or `redis` is not `ok`, block or rollback the deployment.

---

## Fail / Rollback Guidance

| Situation                                                 | Action                                                                                                        |
| :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| Production health `supabase: error` or `redis: error`     | Block new jobs; rollback deploy if introduced by a code change                                                |
| Production health `supabase: missing` or `redis: missing` | Env var not set — add immediately, redeploy Vercel or CDK                                                     |
| Lambda error alarm fires (SNS email)                      | Check CloudWatch Logs for `[ERROR]` pattern; check Sentry for stack trace                                     |
| Jobs stuck in `processing` after Lambda timeout           | Inngest will retry via exponential backoff; LangGraph resumes from last completed node checkpoint             |
| Billing alarm fires ($15 threshold)                       | Check CloudWatch → Billing metrics for spike source; reduce Lambda concurrency if agent pipeline is the cause |
| CDK deploy fails mid-stack                                | Run `cdk:diff` to inspect state; do not manually modify CloudFormation resources — fix IaC and redeploy       |

---

## Where to Look

| Signal                           | Location                                                                            |
| :------------------------------- | :---------------------------------------------------------------------------------- |
| Health status                    | `GET /api/health` → `x-request-id` header                                           |
| Lambda errors                    | CloudWatch Logs → `/aws/lambda/spectra-job-processor`                               |
| Lambda alarms                    | CloudWatch → Alarms → `spectra-jobprocessor-errors`, `spectra-ingesthandler-errors` |
| Billing spike                    | CloudWatch → `spectra-operations` dashboard                                         |
| Pipeline traces                  | LangSmith → project `spectra`                                                       |
| Frontend errors                  | Sentry → spectra project → `source: browser`                                        |
| Lambda errors (with stack trace) | Sentry → spectra project → `source: lambda`                                         |
| Job state                        | Supabase → Table editor → `jobs`                                                    |
| Rate limit hits                  | Upstash Redis → Data browser → keys prefixed `rl:upload` and `rl:auth`              |
| Inngest job history              | Inngest dashboard → Runs                                                            |
