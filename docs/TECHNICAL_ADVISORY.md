# ⚙️ Spectra AI — Technical Advisory

This document records the implementation challenges encountered during development, the root-cause analysis for each, and the solutions applied. It serves as an engineering reference for understanding non-obvious design choices in the codebase.

---

## 1. LangGraph Checkpointing — MemorySaver Is Intentional

### Context

`jobProcessor` runs a full LangGraph `StateGraph` inside a Lambda invocation. LangGraph supports optional checkpointing so that a crashed run can resume from its last completed node rather than starting over.

### Challenge

Lambda functions are stateless. The default `MemorySaver` checkpointer is in-process — it is destroyed when the invocation ends, so there is no cross-invocation resume. An external Redis checkpointer would enable resume, but adds a network round-trip on every node transition and requires careful connection lifecycle management to avoid billing Lambda for idle TCP connections after the handler returns.

### Decision

Spectra's graph is a **single-shot directed pipeline** — `routerNode → [documentNode ‖ visionNode ‖ audioNode] → synthesisNode → auditorNode` — with no human-in-the-loop steps and no inter-invocation pause. The graph starts and completes within a single Lambda invocation. There is no second invocation that needs to resume mid-graph state.

`MemorySaver` is correct for this execution model. Inngest retries on failure restart the graph from `__start__`, which is the right behavior — partial results from a failed run should not be carried forward into a retry.

A Redis-backed checkpointer (custom `BaseCheckpointSaver` over `@upstash/redis`, or `@langchain/langgraph-checkpoint-redis`) would be warranted only if the graph were extended with human-in-the-loop pause steps, split across multiple Lambda invocations, or if Inngest retries needed to skip already-completed nodes rather than rerun the full graph.

**File:** `apps/spectra-api/src/graph/graph.ts`

---

## 2. Bedrock Nova Micro Invocation vs. Direct SDK Models

### Context

The Router Agent classifies which modalities are present using Nova Micro on AWS Bedrock. All other model calls (Document, Vision, Audio, Synthesis, Auditor) go through the Anthropic SDK or OpenAI SDK directly — not Bedrock.

### Challenge

Bedrock's `InvokeModel` API expects a request body shaped to the specific model's contract — Nova Micro uses a `messages` array under a top-level `inferenceConfig` wrapper that differs from the Anthropic Messages API shape. Using the Anthropic SDK client directly against a Bedrock endpoint throws a signing error because the SDK generates its own `Authorization` header that conflicts with AWS SigV4.

### Solution

All Nova Micro calls go through `@aws-sdk/client-bedrock-runtime` using `InvokeModelCommand`. The request body is serialised as JSON and passed as `Uint8Array`. The response body is deserialised and the content string extracted before being passed to the rest of the graph.

The Bedrock scope is intentionally limited to Nova Micro. If a future node requires a Bedrock-hosted Claude model, that decision must be explicit — not the default path.

**File:** `apps/spectra-api/src/lib/bedrock-client.ts`

### Cross-Region Inference Profile Requirement

AWS no longer supports on-demand invocation of Nova models via the bare model ID (`amazon.nova-micro-v1:0`). The model must be invoked through a **cross-region inference profile**, which dynamically routes the request to an available EU region from the pool (`eu-west-1`, `eu-west-2`, `eu-west-3`, `eu-central-1`, `eu-north-1`).

The model ID in use is `eu.amazon.nova-micro-v1:0`. The IAM `bedrock:InvokeModel` policy must cover:

1. The inference profile ARN — includes the account ID: `arn:aws:bedrock:eu-west-1:{account}:inference-profile/eu.amazon.nova-micro-v1:0`
2. The foundation model in any EU region — uses a wildcard region because the profile's routing target is non-deterministic: `arn:aws:bedrock:*::foundation-model/amazon.nova-micro-v1:0`

Hardcoding specific EU region ARNs (e.g. eu-west-1, eu-central-1, eu-north-1) is insufficient — the profile has routed to eu-west-3 (Paris) in production. The wildcard is scoped to a single model ID so it is not overly permissive.

---

## 2.5. Inngest for Job Orchestration — Strategy & Benefits

### What Inngest Does (General)

Inngest is an event-driven, serverless-first job orchestration platform. For AI projects, it solves a fundamental problem: **LLM inference is slow and unreliable.**

A typical AI workflow:

1. User submits a request (PDF upload, image analysis, etc.)
2. Backend classifies the input, routes to specialist agents
3. Multiple LLM calls happen in parallel (Claude, GPT-4o, Whisper, etc.) — each takes seconds to minutes
4. Results are assembled, graded, saved to database

**Without orchestration:** The API would block the user's request waiting for the inference to complete. If inference fails (rate limit, timeout, network error), you retry manually. If a request is submitted twice, two jobs run. No visibility into what's in progress.

**With Inngest:**

- User request returns immediately (202) — backend job queued
- Inngest invokes the job asynchronously, independent of the HTTP response
- If job fails: Inngest retries with exponential backoff (no manual retry code)
- If duplicate event arrives: Inngest deduplicates silently
- Dashboard shows all jobs: pending, running, completed, failed — with full event payloads
- Concurrency limits prevent runaway cost (rate-limit LLM API calls)

### How It Applies to Spectra AI

**Flow:**

```
1. User uploads 3 files (PDF, image, audio) + clicks "Run Analysis"
2. Browser calls /api/upload/confirm (JWT validated, rate-limited)
3. Endpoint fires Inngest event: { jobId, userId, s3Keys }
4. Endpoint returns 202 — client gets job ID, polling begins
5. Inngest receives event, invokes jobProcessor Lambda asynchronously
6. Lambda runs full LangGraph pipeline:
   - Router (Nova Micro) classifies modalities
   - Document, Vision, Audio agents run in parallel
   - Synthesis merges findings
   - Auditor grades faithfulness
7. Results written to Supabase; job marked "completed"
8. Dashboard polls status, renders live synthesis + governance trace
```

**Key design choices:**

| Choice                                       | Why                                                                                                                      | Benefit                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Async invoke (not sync)                      | Vercel timeout: 10–60s. Lambda timeout: 300s. Sync would hang.                                                           | Frontend returns fast; user isn't blocked.                                      |
| Exponential backoff retries                  | LLM APIs fail transiently (rate limits, network hiccups).                                                                | No manual retry logic; Inngest handles it.                                      |
| Checkpointing keyed by `jobId`               | If Lambda times out partway through, retry should resume, not restart.                                                   | Only the failed node reruns; saves cost + time.                                 |
| Single trigger point (`/api/upload/confirm`) | Original design fired Inngest from two places (frontend + S3 Lambda). Race condition: S3 wins before all files uploaded. | Job always processes with complete `s3Keys`.                                    |
| Job state in Supabase + Inngest dashboard    | Dashboard needs "is this job done?" to poll for results. Inngest dashboard needs "did this job retry?" for debugging.    | Frontend has single source of truth (Supabase). Ops has full history (Inngest). |

### Specific Benefits for Spectra

1. **Cost protection** — If a recruiter shares the demo link, 10 concurrent uploads won't spawn 10×6 LLM calls each. Inngest rate-limits the pipeline; CloudWatch billing alarm stops runaway spend.

2. **Reliability** — A transient Nova Micro timeout doesn't fail the entire job. Inngest retries; LangGraph checkpointing resumes from the last completed node (router + document agent don't re-run; vision agent retries).

3. **Observability** — Inngest dashboard shows:
   - Which jobs succeeded, failed, were rate-limited
   - Full event payload (s3Keys, jobId, userId)
   - Retry count, timestamps, error messages
   - No guessing from CloudWatch logs

4. **Decoupling** — The Vercel function and Lambda are completely independent. Vercel handles auth + rate limiting. Lambda handles inference. Inngest mediates between them.

### Why Not SQS or Step Functions?

- **SQS:** Raw queue. You manage retries, deduplication, state tracking yourself. Good for simple fan-out; not good for complex workflows.
- **Step Functions:** Designed for Lambda-to-Lambda orchestration (`invoke → wait → invoke`). Spectra has one entry point (jobProcessor). Step Functions would be overkill and add latency (extra AWS API round-trips).
- **Inngest:** Built for serverless. Free tier for dev + prod. Retries + dedup + dashboard baked in. Simpler mental model: event fires → function runs → writes results.

**File references:** `apps/spectra-app/lib/inngest.ts`, `apps/spectra-api/src/handlers/jobProcessor.ts`, `apps/spectra-api/src/graph/graph.ts`

---

## 3. Inngest Event Deduplication — S3 Trigger Race Condition

### Context

The original design fired Inngest from two places: `POST /api/upload/confirm` (frontend, after all files are uploaded, with full `s3Keys`) and `ingestHandler` (Lambda, on S3 `ObjectCreated`, once per file). The S3 trigger was intended as a safety net in case the frontend call failed mid-flight. In practice, the Lambda fires fast enough from S3 to win the idempotency key BEFORE the confirm endpoint, so the wrong event gets processed with only one file's data. Both used `id: jobId` as the Inngest idempotency key, expecting Inngest to deduplicate silently. The deduplication assumption was wrong in practice.

### Challenge

The deduplication assumption failed in production. S3 triggers fire fast — the Lambda can invoke Inngest **before** the browser finishes uploading all files and calls the confirm endpoint. When that happens:

1. The Lambda's event wins the idempotency key with only **one file's** `s3Keys` (one invocation per S3 file, not one per job).
2. The confirm endpoint's event — which carries all three `s3Keys` — is rejected as a duplicate.
3. `jobProcessor` runs with incomplete data: one modality instead of three.
4. The remaining two Lambda invocations (one per additional file) also get rejected by Inngest, throwing unhandled errors and triggering the CloudWatch `spectra-ingesthandler-errors` alarm.

The architectural assumption was "frontend trigger always arrives first." In practice, the S3 → Lambda → Inngest path is faster than the browser's confirm POST once S3 acknowledges the upload.

### Solution

Removed the Inngest trigger from `ingestHandler` entirely. The handler now validates (size, extension) and logs only. The `POST /api/upload/confirm` endpoint is the **sole** Inngest trigger — it fires once, after all uploads complete (`Promise.all`), with the full `s3Keys` payload for all modalities.

**Lesson:** Do not rely on event idempotency keys as a correctness mechanism when two trigger sources carry **different payloads**. Idempotency deduplication is a last-resort guard against exact duplicates — not a merge strategy for partial data. If a safety-net trigger is needed, it must carry the same complete payload as the primary trigger.

**Files:** `apps/spectra-api/src/handlers/ingestHandler.ts`, `apps/spectra-app/app/api/upload/confirm/route.ts`

---

## 4. Upstash Vector Session Isolation

### Context

The Document Agent vectorises chunked PDF content using `text-embedding-3-small` and retrieves relevant chunks via RAG during synthesis. Upstash Vector is a shared index — all jobs write to the same namespace by default.

### Challenge

Without isolation, a retrieval query for Job A can return chunks from Job B if the cosine similarity is high enough. For a security analyst processing a confidential PDF, cross-job bleed is both a correctness failure and a data-handling concern.

### Solution

Every upsert and query call is scoped to a `{jobId}/{userId}/` namespace prefix. Upstash Vector supports arbitrary string prefixes on vector IDs — the prefix is prepended on write and used as a filter on read. On job completion, all vectors under `{jobId}/{userId}/` are deleted to avoid unbounded storage growth.

**File:** `apps/spectra-api/src/graph/nodes/documentNode.ts`

---

## 5. Health Probe — Supabase REST vs. SDK Client

### Context

`GET /api/health` probes both Supabase and Upstash Redis to verify runtime dependencies before returning a status response. This endpoint is hit by `scripts/verify-ready.mjs` and UptimeRobot.

### Challenge

Instantiating the Supabase JS SDK client inside the health probe to make a simple liveness check is expensive — the SDK initialises a realtime WebSocket connection on construction that is never used and never cleaned up inside a serverless function. It also requires both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and any SDK-level exception surfaces as an unhandled rejection rather than a clean probe result.

### Solution

The Supabase probe uses a raw `fetch()` to `${url}/rest/v1/jobs?select=id&limit=1` with the `apikey` header set to the service key. Querying a real table is required — the PostgREST root (`/rest/v1/`) returns 200 even when the database is paused, so it is not a reliable liveness signal. The service key is used (not the anon key) because RLS blocks anon-key reads on the `jobs` table. A 200 response from the table query confirms the database is live. No SDK, no WebSocket, no client state. The Redis probe uses Upstash's REST API at `/ping` — returns `{ result: "PONG" }` on success. Both probes are wrapped in a 4-second `AbortSignal.timeout` to prevent the health handler from hanging.

**Files:** `apps/spectra-app/lib/health-probes.ts`, `apps/spectra-app/app/api/health/route.ts`

---

## 6. Lambda Concurrency Cap — Removed at Deploy (Phase 5)

### Context

`jobProcessor` invokes Bedrock (Nova Micro), Anthropic SDK (Claude Sonnet ×2), and OpenAI SDK (GPT-4o ×2, Whisper ×1) per job. At portfolio-demo scale, the real cost risk is runaway parallelism, not throughput.

### Challenge

Without a concurrency limit, a burst of upload requests (e.g. a recruiter sharing the demo link) could spin up 20+ simultaneous Lambda executions, each making 6 LLM API calls. The CloudWatch $15/month billing alarm is the last line of defence — not a first-line cost guard.

### Solution

`reservedConcurrentExecutions: 1` was the intended CDK configuration. At deploy time, AWS rejected it: new accounts have a default regional concurrency limit of 10, and reserving 1 would drop the unreserved pool below AWS's enforced minimum of 10.

The setting was removed. Cost protection at portfolio scale is provided by two other mechanisms already in place: the Upstash rate limiter (3 req/day/IP on `/api/upload`) and the CloudWatch billing alarm ($15/month). The concurrency cap was belt-and-suspenders — not the primary guard.

To re-enable it: request a Lambda concurrency limit increase via AWS Support (Service Quotas → Lambda → Concurrent executions), then restore `reservedConcurrentExecutions: 1` in `compute-stack.ts` and redeploy.

**File:** `apps/spectra-api/lib/stacks/compute-stack.ts`

---

## 7. PII Redaction — Coverage Across All Text Modalities

### Context

All three text-producing modalities (document, audio, vision output) generate text that flows into LLM prompts, Upstash Vector, and LangSmith traces. Any PII in those texts would be: (1) embedded into vector store metadata and retrievable across future queries, (2) forwarded to LLM API providers as part of prompts, and (3) logged in LangSmith traces accessible to the operator.

### Challenge

Redaction must happen before `upsert()` — not after. Post-hoc deletion from a vector index is unreliable because embeddings already carry semantic signal about the original text, and there is no guarantee all fragments are found and removed. The same principle applies to LLM prompt construction: PII must be stripped before the API call, not after.

### Solution

`redactPii()` in `src/lib/pii-redaction.ts` applies nine regex patterns and is called at the appropriate boundary in each text-producing node:

- **`documentNode`** — raw PDF text is redacted before chunking and Upstash Vector upsert. The unredacted text is never written to the index.
- **`audioNode`** — Whisper transcript is redacted immediately after injection check, before the Claude Sonnet extraction call. The redacted transcript is what Claude receives and what is stored in `AudioOutput.transcript`.
- **`visionNode`** — GPT-4o's `rawDescription` and `findings` are redacted after JSON parsing, before `VisionOutputSchema.parse()`. GPT-4o sees the raw image (unavoidable — it is the vision model), but its text output is scrubbed before entering graph state.

The synthesis report is generated from redacted modality outputs — the auditor scores the redacted synthesis, not the original. All three output schemas carry `redactedFields: string[]` listing which pattern labels fired.

**Pattern coverage:** email, US phone, SSN, credit card, UK NINO, date of birth (US `MM/DD/YYYY` and ISO `YYYY-MM-DD`), street address, contextual person name (title-prefixed: `Patient: John Smith`).

**Known limitation:** The person name pattern requires a preceding title or role token (`Name:`, `Patient:`, `Dr`, `Mr`, etc.) to avoid excessive false positives on any two capitalised words. Free-form names without context will not be caught. Production-grade coverage would require an NER model (e.g. spaCy, AWS Comprehend) — this is noted in HARDENING_ROADMAP.md.

**Files:** `apps/spectra-api/src/lib/pii-redaction.ts`, `apps/spectra-api/src/graph/nodes/documentNode.ts`, `apps/spectra-api/src/graph/nodes/audioNode.ts`, `apps/spectra-api/src/graph/nodes/visionNode.ts`

---

## 8. pdf2json Raw Data Access in v3

### Context

The Document Agent uses `pdf2json` to extract text from PDF uploads before chunking and vectorising.

### Challenge

`pdf2json` v3 changed its internal output shape. `getRawTextContent()` returns an empty string in v3 — the method exists but the underlying `rawTextContent` property is never populated. Relying on it produces silent empty-string results that pass through to the embedding stage without error.

### Solution

Read the raw data tree directly: `data.Pages[n].Texts[n].R[n].T`, then `decodeURIComponent()` each token. This accesses the underlying parsed structure that `getRawTextContent()` was intended to summarise. The `pdfParser_dataReady` callback receives the raw `Output` type; it is cast to `Record<string, unknown>` for safe traversal.

**File:** `apps/spectra-api/src/graph/nodes/documentNode.ts`

---

## 9. Inngest v4 `createFunction` Signature Change

### Context

Inngest v4 (installed as `^4.2.4`) changed the `createFunction` API from a 3-argument form to a 2-argument form.

### Challenge

The v3 signature was `createFunction(options, trigger, handler)`. v4 merges `trigger` into `options` under a `triggers` array key: `createFunction({ id, triggers: [{ event }] }, handler)`. TypeScript surfaces this as "Expected 2 arguments, but got 3" — the compiler error is clear, but the fix is non-obvious without reading the v4 changelog.

### Solution

The `processJobFn` in `lib/inngest.ts` uses the v4 2-argument form with `triggers` inside the options object. The `event` handler type annotation is explicit (`{ event: { data: { jobId, userId, s3Keys } } }`) because Inngest's generic type inference requires typed event schemas for full inference.

**File:** `apps/spectra-app/lib/inngest.ts`

---

## 10. `withSentryConfig` Deprecated Options (Phase 4)

### Context

`@sentry/nextjs` wraps `next.config.ts` via `withSentryConfig(nextConfig, opts)`. The second argument is typed as `SentryBuildOptions`.

### Challenge

Several option names changed between SDK versions. `hideSourceMaps` (old) → `sourcemaps: { disable: boolean }` (new). `disableLogger` was removed entirely. `automaticVercelMonitors` moved from the top level into a `webpack` sub-key. TypeScript surfaces these as "Object literal may only specify known properties" — the error is clear but the correct target key is not obvious from the error message alone.

### Solution

Use `sourcemaps: { disable: process.env.NODE_ENV !== "production" }` to suppress source-map upload in non-production builds. Move `automaticVercelMonitors` under `webpack: { automaticVercelMonitors: true }`. Do not set `disableLogger` — the option no longer exists.

**File:** `apps/spectra-app/next.config.ts`

---

## 11. Vitest Picking Up Playwright `.spec.ts` Files (Phase 4)

### Context

`apps/spectra-app` runs both Vitest (unit tests) and Playwright (E2E tests) from the same `tests/` directory tree.

### Challenge

The default Vitest glob `tests/**/*.{test,spec}.{ts,tsx}` matches Playwright `.spec.ts` files. When Vitest imports a `.spec.ts` file, it encounters Playwright's `test.describe` — which is not a Vitest global — and throws at collection time, causing the entire Vitest run to fail with a confusing "test.describe is not a function" error.

### Solution

Narrow the Vitest `include` pattern to `tests/**/*.test.{ts,tsx}` (no `spec` variant) and add `exclude: ["tests/e2e/**"]` as a belt-and-suspenders guard. Playwright files use `.spec.ts` exclusively; Vitest unit tests use `.test.ts` exclusively — the suffix convention is the isolation boundary.

**File:** `apps/spectra-app/vitest.config.ts`

---

## 12. Vitest Constructor Mock — Arrow Function Cannot Be `new`'d (Phase 4)

### Context

`/api/upload/route.test.ts` mocks `S3Client` from `@aws-sdk/client-s3` and `Ratelimit` from `@upstash/ratelimit`. Both are used as constructors (`new S3Client(...)`, `new Ratelimit(...)`).

### Challenge

`vi.fn().mockImplementation(() => ({ send: mockSend }))` creates an arrow-function-based mock. Arrow functions cannot be called with `new` — attempting it throws "S3Client is not a constructor" at runtime even though the mock looks valid. A second issue: `Ratelimit.slidingWindow` is a static method called at module load time to configure the instance; the mock must expose it as a property on the constructor function itself, not on the returned instance.

### Solution

Use `function` keyword declarations (not arrow functions or `vi.fn()`) for constructor mocks:

```ts
const MockRatelimit = function Ratelimit() {
  return { limit: mockLimit };
};
MockRatelimit.slidingWindow = vi.fn().mockReturnValue({});
```

Extract `mockSend` and `mockLimit` as module-level `vi.fn()` refs so individual tests can override return values without redefining the mock. Remove `vi.resetModules()` from `beforeEach` — it invalidates module-level mock refs and causes the constructor reference to diverge from the test's captured ref.

**File:** `apps/spectra-app/tests/api/upload/route.test.ts`

---

## 17. Red Team Tests Cannot Import synthesisNode Directly (Phase 7)

### Context

`red-team.test.ts` needs to test `validateSynthesisReport()` in isolation — no LLM calls, no network.

### Challenge

`synthesisNode.ts` initialises `new OpenAI(...)` at module scope. Importing anything from that file in a test environment throws `Missing credentials` immediately at import time, before any test runs.

### Solution

`validateSynthesisReport` was extracted to `src/lib/synthesis-guardrails.ts`, which imports only `detectPromptInjection`. `synthesisNode.ts` now imports the function from there. The test imports directly from the lib — no OpenAI client is ever instantiated.

**Files:** `apps/spectra-api/src/lib/synthesis-guardrails.ts`, `apps/spectra-api/src/graph/nodes/synthesisNode.ts`

---

## 15. Synthesis Guardrail Runs Post-Parse, Pre-Auditor (Phase 6)

### Context

`synthesisNode` produces a JSON-wrapped report from GPT-4o. The report is parsed and validated by `SynthesisOutputSchema.parse()`. A content safety guardrail runs on the parsed `report` string after schema validation.

### Challenge

Running the guardrail before `JSON.parse()` would block on the raw LLM output, which includes JSON boilerplate and escape characters — legitimate citation tags like `[D1]` would be obscured by JSON encoding and fail the regex. Running after `parse()` means the report is already a clean string.

### Solution

`validateSynthesisReport()` is called immediately after `SynthesisOutputSchema.parse()` succeeds. It checks report length, injection patterns on the final markdown text, and citation tag presence. The citation check is a warn (not throw) — some fallback synthesis paths may not tag every claim.

**File:** `apps/spectra-api/src/graph/nodes/synthesisNode.ts`

---

## 16. Prompt Injection — Vision Node Exempt (Phase 6)

### Context

`documentNode` and `audioNode` both run `detectPromptInjection()` on extracted text. `visionNode` does not run injection detection at the input boundary.

### Challenge

An attacker could embed injection text in a screenshot or image. Should `visionNode` check something?

### Solution

`visionNode` sends raw image bytes (base64-encoded) directly to GPT-4o's vision API — there is no intermediate text extraction step before the model call. GPT-4o's system prompt constrains the output format; the model receives the image, not text derived from it. Adding a vision OCR step solely to run the injection check would add latency and cost with marginal benefit — GPT-4o's own safety guardrails handle injected image text. The injection surface in this pipeline is user-supplied text (PDFs, audio), not images.

However, GPT-4o's text output (`rawDescription`, `findings`) is PII-redacted and injection-checked (`detectPromptInjection()`) before it enters graph state — see Section 7. This covers the case where an image contains visible PII (e.g. a photo of a document showing an email address or SSN) or embedded injection text that GPT-4o echoes verbatim into its description.

**File:** `apps/spectra-api/src/graph/nodes/visionNode.ts`

---

## 14. Semantic Input Gating — Trade-off Analysis

### Context

Current injection detection (`detectPromptInjection()`) is lexical: 14 regex patterns match known attack phrases verbatim. A paraphrased jailbreak — "disregard your prior instructions" rephrased as "pay no attention to what you were told before" — would not be caught.

### Challenge

Should a semantic classifier replace or supplement the regex gate?

### Solution (not yet implemented — see HARDENING_ROADMAP)

The production-hardening answer is a lightweight semantic classifier running on extracted text before the injection regex check. Nova Micro on Bedrock is the correct choice: it is already in the stack (Router node), costs ~$0.035/1M input tokens, and classification is exactly the task it was designed for.

**Trade-off:** semantic gating adds a Bedrock round-trip (~50–100 ms, ~$0.000035/1K tokens) to every document and audio job. On the free tier with a hard $15/month billing ceiling, this cost is meaningful at scale. The mitigation is to gate only when the regex check is inconclusive, or to cap input to the first N tokens of extracted text (e.g. first 500 tokens) rather than the full document. You would not run the semantic gate over an entire 100-page PDF on every job.

**Why Nova Micro over GPT-4o-mini:** Nova Micro is ~4–5× cheaper on input tokens ($0.035/1M vs $0.15/1M) and the classification task does not require GPT-4o-mini's broader reasoning capability. The trade-off is a second cloud vendor dependency (AWS Bedrock), which is already accepted for the Router node.

**Status:** Noted in HARDENING_ROADMAP.md as a medium-effort security item.

---

## Update Rules

Update this document when a technical challenge is diagnosed and resolved that:

- Required non-obvious investigation (not just fixing a typo or wrong variable)
- Involved a library or AWS service behaving differently than documented
- Required a structural workaround (lazy init, batching, capping, namespace isolation) rather than a simple fix
- Would be confusing to a future reader without context

If a code change resolves one of these challenges differently, update the relevant entry rather than appending a new one.

---

## 14. Vercel Framework Detection Fails in Monorepo Subdirectory (Phase 5)

### Context

`spectra-app` is deployed from `apps/spectra-app/` inside the `spectra-ai` monorepo. Vercel's root directory setting is configured to `apps/spectra-app`.

### Challenge

Vercel's automatic framework detection did not recognise the project as Next.js when the root directory was set to a subdirectory. The "Application Preset" field on the import screen appeared blank even after manually selecting Next.js — it reset once the subdirectory was chosen. The build completed successfully in ~38s (correct Next.js build time) and deployments showed "Ready", but all routes returned Vercel's own `404: NOT_FOUND` infrastructure error rather than the Next.js app. Nothing appeared in build logs because the build itself succeeded — the failure was in Vercel's routing layer, which did not apply Next.js-specific route handling without framework detection.

### Solution

Add `vercel.json` at `apps/spectra-app/` (the configured root) with explicit framework declaration:

```json
{ "framework": "nextjs" }
```

This tells Vercel's build infrastructure to apply Next.js-specific output handling regardless of auto-detection. The file must live in the root directory Vercel is configured to build from — not the monorepo root.

**File:** `apps/spectra-app/vercel.json`

---

## 13. S3 → Lambda Event Notification — Cross-Stack CDK Wiring (Phase 5)

### Context

`ingestHandler` must fire on every S3 `ObjectCreated` event in the `spectra-uploads` bucket. The bucket lives in `StorageStack`; the Lambda lives in `ComputeStack`. These are separate CDK stacks to keep concerns separated and avoid re-deploying the bucket when Lambda code changes.

### Challenge

Calling `bucket.addEventNotification(EventType.OBJECT_CREATED, new LambdaDestination(fn))` from inside `StorageStack` requires a reference to the Lambda, creating a dependency on `ComputeStack`. Calling it from inside `ComputeStack` requires a full `IBucket` reference — imported buckets via `Bucket.fromBucketName()` do not support `addEventNotification` in CDK v2 (the method requires a concrete `Bucket` to attach the custom resource). Either direction creates a circular or unsupported dependency.

### Solution

Wire the notification at app level in `bin/spectra-api.ts`, after both stacks are instantiated but before `app.synth()`. The concrete `Bucket` object from `StorageStack` is passed directly; CDK exports the Lambda ARN from `ComputeStack` and imports it into the bucket notification configuration in `StorageStack`. No circular dependency — `StorageStack` and `ComputeStack` remain independent of each other. CDK resolves deployment order automatically from the cross-stack export/import.

**File:** `apps/spectra-api/bin/spectra-api.ts`

---

## 18. S3 Pre-Signed URL Upload Flow — Architecture Decision (Phase 8)

### Context

The original upload route (`/api/upload`) received file bytes as `multipart/form-data`, loaded them into the Vercel function's memory, and forwarded them to S3 via `PutObjectCommand`. This works at demo scale but has three problems at production scale: Vercel function memory ceiling (1GB), Vercel egress billing for file transfer, and a single synchronous upload path that blocks the response.

### Decision

Split the upload into three steps:

1. `POST /api/upload/presign` — validates file metadata (no bytes), creates the job in Supabase, generates per-file S3 pre-signed PUT URLs (5-min TTL via `@aws-sdk/s3-request-presigner`). Rate limiting and JWT validation happen here.
2. Browser PUTs each file directly to S3 using the signed URL — Vercel is not in the file transfer path.
3. `POST /api/upload/confirm` — verifies the job belongs to the requesting user, fires Inngest to start the pipeline.

The old `/api/upload` route is retained. The `uploadFiles()` helper in `api.ts` is the sole entry point — it orchestrates the three steps transparently, so the dashboard page required no changes.

**Files:** `apps/spectra-app/app/api/upload/presign/route.ts`, `apps/spectra-app/app/api/upload/confirm/route.ts`, `apps/spectra-app/lib/api.ts`

---

## 19. Upstash Vector Deduplication — Latency vs. Index Purity Tradeoff (Phase 8)

### Context

Repeated boilerplate sections (headers, standard clauses, footers) were being embedded multiple times per document, inflating the Upstash index and diluting cosine similarity scores for unique content.

### Decision

Before each chunk upsert, query the index for the chunk's nearest neighbour. Skip the chunk if similarity ≥ 0.97. This adds one Upstash query per chunk (sequential, not parallel, because the deduplication check must precede the upsert). For a 50-chunk document this is at most 50 extra queries — acceptable at demo scale and on Upstash's free tier. At higher document throughput, batch the deduplication queries.

The threshold of 0.97 was chosen conservatively: text-embedding-3-small rarely scores above 0.95 for semantically similar but distinct passages. 0.97 catches only near-verbatim copies.

**File:** `apps/spectra-api/src/graph/nodes/documentNode.ts`

---

## 20. CDK CloudWatch Alarm — Cross-Region Constraint (Phase 8 Deploy)

### Context

`ObservabilityStack` was written as a single stack intended to own both the billing alarm (CloudWatch `EstimatedCharges`) and the Lambda MetricFilter error alarms. The billing alarm referenced `us-east-1` via `region: "us-east-1"` on the `Metric` object; the stack itself was originally deployed to `us-east-1` to keep them together.

### Challenge — Two compounding bugs

**Bug 1 — Wrong region for MetricFilters.**
When the stack was in `us-east-1`, `LogGroup.fromLogGroupName()` performed a live CloudFormation lookup for the Lambda log groups — which live in `eu-west-1`. CloudFormation found nothing and returned `400 NotFound`, causing `SpectraObservabilityStack` to roll back with `UPDATE_ROLLBACK_COMPLETE`.

Correcting the stack region to `eu-west-1` (so MetricFilters could reach the log groups) then surfaced the second bug:

**Bug 2 — CDK AlarmRegionMismatch.**
CDK enforces that `cloudwatch.Alarm` must live in the **same region as its metric**. `AWS/Billing EstimatedCharges` metrics only exist in `us-east-1`. Deploying the stack to `eu-west-1` and referencing the billing metric threw `AlarmRegionMismatch` at synthesis time — before CloudFormation was even reached.

Setting `region: "us-east-1"` on the `Metric` object is only a read-side reference; it does not move the Alarm resource. A single CDK stack cannot satisfy both constraints simultaneously.

### Solution

Split into two separate stacks:

| Stack                              | Region      | Contains                                                                                            |
| :--------------------------------- | :---------- | :-------------------------------------------------------------------------------------------------- |
| `SpectraObservabilityStack`        | `eu-west-1` | MetricFilters, Lambda error alarms, CloudWatch dashboard, SNS error topic (`spectra-lambda-errors`) |
| `SpectraBillingAlarmStack` _(new)_ | `us-east-1` | Billing alarm, SNS billing topic (`spectra-billing-alerts`)                                         |

Additional fix in `ComputeStack`: the two `logs.LogGroup` constructs were changed from local `const` variables to `public readonly` fields (`ingestHandlerLogGroup`, `jobProcessorLogGroup`). `ObservabilityStack` now receives them via props as `ILogGroup` references instead of calling `LogGroup.fromLogGroupName()`. This eliminates the live lookup entirely — CDK knows the construct exists because it was just created in the same synthesis pass.

**Bootstrap note:** Before deploying for the first time (or after deleting stacks), `us-east-1` must be bootstrapped separately:

```bash
cdk bootstrap aws://ACCOUNT_ID/us-east-1
```

The `eu-west-1` bootstrap (already done at project init) does not cover `us-east-1`.

**Files:** `apps/spectra-api/lib/stacks/observability-stack.ts`, `apps/spectra-api/lib/stacks/compute-stack.ts`, `apps/spectra-api/lib/stacks/billing-alarm-stack.ts`, `apps/spectra-api/bin/spectra-api.ts`

---

## 21. Upstash Vector Eventual Consistency — In-Memory Cosine Similarity

### Context

`documentNode` embeds PDF chunks with `text-embedding-3-small`, upserts them to an Upstash Vector namespace scoped to the job, then immediately queries that namespace to retrieve the top-5 most relevant chunks for Claude.

### Challenge

Upstash Vector is eventually consistent. Vectors upserted via the REST API are not immediately queryable — a `query` call issued in the same Lambda invocation, milliseconds after `upsert`, reliably returns 0 results. This caused `documentNode` to fall through to the `EMPTY_OUTPUT` path on every job, producing 0% document confidence and no `[D...]` citations in the synthesis report regardless of whether the PDF was successfully parsed.

The bug was masked by two factors:

1. `parsePdf` extracted text correctly (confirmed via CloudWatch: "pages count: 2, texts: 80, runs: 80, text length: 1391") — the failure was silent and downstream.
2. When all three modalities ran in parallel, LangGraph's `Send` branching silently dropped the `documentOutput` state update if the node threw, making it appear as if the document node never ran.

A separate bundling issue compounded diagnosis: `pdf2json` v4 loads from a pure-JS bundle in `dist/`, but esbuild inlined it incorrectly in earlier iterations — fixed by moving it to `nodeModules` in the CDK `NodejsFunction` bundling config so it is installed as a real package.

### Solution

All chunk embeddings are computed and held in memory during the embed loop. After the loop, cosine similarity between the query embedding and each chunk embedding is computed in-process — no round-trip to Upstash Vector needed. The vector upsert is retained as a fire-and-forget audit trail write (non-critical path):

```typescript
// In-memory cosine similarity — avoids Upstash eventual consistency on immediate query
const topChunks = embeddedChunks
  .map((c, i) => ({
    id: `D${i + 1}`,
    chunk: c.chunk,
    relevanceScore: cosineSimilarity(queryEmbedding, c.vector),
  }))
  .sort((a, b) => b.relevanceScore - a.relevanceScore)
  .slice(0, 5);
```

This is strictly faster (one fewer HTTP round-trip per job), more reliable, and makes the document node's retrieval step self-contained.

**Files:** `apps/spectra-api/src/graph/nodes/documentNode.ts`, `apps/spectra-api/lib/stacks/compute-stack.ts`

---

## 22. Supabase Data API — Explicit Grants Required from Oct 30, 2026

### Context

Supabase notified (May 2026) that the Data API (PostgREST, supabase-js, GraphQL) will no longer auto-expose tables in the `public` schema by default. New projects are affected from 2026-05-30; all existing projects from 2026-10-30.

### Challenge

Spectra AI's `001_jobs.sql` migration created the `jobs` table without an explicit `GRANT` statement for the `authenticated` role. The table relied on the default access that is being removed. The spectra-app frontend uses supabase-js (Data API) with JWT-authenticated requests that resolve to the `authenticated` role — without an explicit grant, those requests return `42501` permission errors even when valid RLS policies are in place.

### Solution

Migration `003_data_api_grants.sql` adds:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
```

`anon` receives no grant — Spectra requires authentication for all operations. `service_role` is skipped — Lambda functions connect via a direct Postgres connection string, not the Data API.

RLS policies are unchanged and continue to enforce per-user row isolation. The grant only unlocks PostgREST access at the schema layer and is idempotent.

### Trade-off

None. Grants are additive; RLS is the enforcement boundary. Granting all four DML verbs to `authenticated` is intentionally uniform — RLS rejects any write that violates per-user policy regardless.

**Future path:** All new migrations must include explicit grants alongside `CREATE TABLE` and RLS statements.

**Files:** `apps/spectra-api/migrations/003_data_api_grants.sql`

---

## 23. Document Head as RAG Query — Heuristic Trade-off Between Efficiency and Coverage

### Context

`documentNode` chunks and vectorises PDF content to enable RAG (Retrieval Augmented Generation). The retrieval step selects the top-5 most relevant chunks to send to Claude Sonnet for extraction. Unlike a typical RAG pipeline where the user provides a query ("What is the patient's blood pressure?"), Spectra has no explicit user query — the system simply needs to extract all findings from the document.

### Challenge

A naive RAG approach would send all chunks to Claude, but this is expensive (large token count) and dilutes focus. A multi-query approach (querying with "Findings", "Key information", "Important details", etc.) would run the embedding model multiple times per document — acceptable at demo scale but not scalable.

The original design selected the document's opening (first 1000 characters) as an implicit query vector, assuming that the document's introduction is representative of its overall content and structure. This retrieves chunks most similar to the opening.

### Trade-off Analysis

**Assumption:** Document openings are representative
- **Works well for:** Reports, analyses, memos (topic set in opening, details follow)
- **Works poorly for:** Unstructured documents where important details appear late, documents with headers/boilerplate at the top, long preambles before substantive content

**Efficiency gain:** Only ~50 chunk embeddings per document + 1 query embedding + in-memory cosine similarity. No multi-query loops.

**Coverage risk:** A critical fact buried in the document's conclusion may score low similarity to the opening and be filtered out in top-5 selection.

### Solution Implemented

The document head (first 1000 chars) is vectorized and used as the similarity query. The top-5 chunks are selected by cosine similarity and sent to Claude. This is fast and scalable but makes a structural assumption about document content distribution.

### Alternatives Not Taken

| Approach                        | Pros                                           | Cons                                                                              |
| :------------------------------ | :--------------------------------------------- | :-------------------------------------------------------------------------------- |
| **Send all chunks**             | Complete coverage; no risk of missed findings  | Large token count; costly; Claude loses focus; slower synthesis                  |
| **Multi-query (5 different)**   | Better coverage; less bias to opening          | 5× embedding calls per document; higher latency; higher cost                     |
| **Middle section as query**     | May be more representative than opening        | Still a heuristic; no principled reason to prefer middle                         |
| **Claude selects chunks first** | Adaptive; Claude decides what's relevant       | Requires 2-step flow; doubles inference cost; breaks determinism                 |
| **Entire document as query**    | Uses full context                              | Circular comparison (every chunk high similarity to whole); adds noise            |

### Recommendation for Future Refinement

For portfolio-scale MVP, document-head heuristic is acceptable. If coverage gaps appear in real user PDFs:

1. **Increase top-k** from 5 to 7-10 chunks (modest token increase, better coverage)
2. **Add fallback multi-query** for docs where top-5 similarity < 0.6 (signals opening is non-representative)
3. **Sample document structure** (check if opening is boilerplate via length of first sentence, presence of "Contents" or "Table of Contents") and adjust strategy

Do not default to sending all chunks — the cost and quality degradation are real.

**File:** `apps/spectra-api/src/graph/nodes/documentNode.ts` (lines 157-166)

---

## 24. Auditor Model Choice — Claude Sonnet over GPT-4o Mini

### Context

The Auditor node evaluates the Synthesis report for faithfulness and hallucinations by comparing it against source findings from the Document, Vision, and Audio agents. It scores confidence per modality (0-100), identifies ungrounded claims, and maps findings to NIST AI RMF control IDs.

The model choice is Claude Sonnet. A natural cost-saving question: why not GPT-4o mini, which is smaller and cheaper?

### Why Sonnet (Not Mini)

The Auditor's core task is **hallucination detection**, which requires nuanced reasoning:

| Capability                            | Claude Sonnet | GPT-4o Mini | Impact on Auditor                                                        |
| :------------------------------------ | :------------ | :---------- | :----------------------------------------------------------------------- |
| **Subtle hallucination detection**    | Strong        | Weak        | Mini misses plausible-sounding false claims not grounded in findings     |
| **Structured JSON reliability**       | High          | Medium      | Mini parse failures trigger fallback scoring (75 default, not real grade) |
| **NIST control ID mapping**           | Reliable      | Unreliable  | Mini invents or mis-assigns control IDs; Sonnet understands domain       |
| **Faithfulness scoring nuance**       | 0-100 granular| Coarse      | Mini tends toward middle scores; Sonnet differentiates strong vs weak     |
| **Cost per invocation**               | ~$0.015       | ~$0.0015    | 10× cheaper; not worth the quality loss                                  |

**Example hallucination Auditor must catch:**
```
Source findings: "Patient had fever and cough"
Synthesis report: "Patient had fever, cough, and shortness of breath"
                                              ↑ hallucinated (not in source)

Mini: May score 85 faithfulness (reads as plausible)
Sonnet: Scores 60-70 faithfulness (detects extrapolation)
```

### Why Sonnet (Not Opus)

Sonnet is the balance:
- Cheap enough for portfolio scale
- Strong enough for hallucination reasoning
- Opus would be overkill and add unnecessary latency/cost

### Trade-off Accepted

Auditor is the **bottleneck LLM call** in the pipeline (runs after all 3 agents complete). Using Sonnet instead of mini adds ~$0.014 per job. At demo scale (100 jobs/month), this is <$1.50 overhead for significantly better hallucination detection.

If you want to experiment with mini for cost reasons: expect to see more undetected hallucinations, more fallback scorings (75 default), and weaker NIST mappings. The savings ($1.50/month) are not worth the quality loss.

### Future Monitoring

If audit quality degrades in production (auditor scores drift toward 75, hallucinations escape undetected):
1. Check `auditorNode` parse error rate in CloudWatch
2. Review LangSmith runs for Auditor model performance
3. Do not downgrade to mini; upgrade to Opus if needed

**File:** `apps/spectra-api/src/graph/nodes/auditorNode.ts` (lines 49-99)

---

## 25. Video as Fourth Modality — Architecture and Guardrail Considerations

### Context

The current pipeline supports three modalities: document (PDF), vision (image), and audio. Video is the most architecturally significant extension because it contains both visual and audio tracks — effectively bundling the vision and audio sub-pipelines into one node. This section documents how video would fit into the graph and what guardrail layers it would require.

This is a roadmap item, not yet implemented. See [HARDENING_ROADMAP.md — Future Modalities](./HARDENING_ROADMAP.md#future-modalities).

### Architecture

A `videoNode` would run two internal sub-pipelines in parallel before merging results:

- **Video frames** — keyframe sampler (e.g. 1 frame/second, capped at ~60 keyframes) → batched GPT-4o vision calls → `VisionOutput[]`
- **Audio track** — extracted audio stream → Whisper transcription → Claude Sonnet structured extraction → `AudioOutput`

The LangGraph parallel tier would become: `documentNode ‖ visionNode ‖ audioNode ‖ videoNode → synthesisNode → auditorNode`.

A `VideoOutput` schema would include `frames: VisionOutput[]`, `transcript: AudioOutput`, and `timeline: Array<{ timestamp: number; event: string }>` for temporal anchoring of findings.

### Guardrail Stack for Video

| Layer | What | Implementation |
| :--- | :--- | :--- |
| Pre-gate | Duration + size cap | 30s / 25 MB limit enforced at `ingestHandler` before S3 write — rejects before any processing cost is incurred |
| Metadata strip | EXIF / container metadata | Videos embed GPS coordinates, device serial numbers, and capture timestamps — strip at ingest using an `ffprobe`/`ffmpeg` Lambda layer before the file is written to S3 |
| Injection gate (audio track) | Regex + semantic on transcript | Same path as `audioNode` — `detectPromptInjection()` then semantic gate |
| PII redaction (audio track) | `redactPii(transcript)` | Identical to `audioNode` — transcript redacted before Claude Sonnet and before graph state |
| PII redaction (frame descriptions) | `redactPii` on GPT-4o text output | Identical to `visionNode` — `rawDescription` and `findings` scrubbed after GPT-4o response parsing |
| Biometric PII | Faces, voice prints | **New hard problem — see below** |
| Output guardrail | `validateSynthesisReport` | Unchanged — `videoNode` output feeds `synthesisNode`, same post-synthesis gate applies |

### The New Hard Problem: Biometric PII

Regex and semantic classifiers operate on text. Faces and voice prints are biometric identifiers that exist in the pixel and audio sample domains — no text-level pattern can redact them.

**Faces in frames:** AWS Rekognition face detection identifies bounding boxes for detected faces. Frames are blurred at those regions before base64 encoding for GPT-4o. This prevents the model from receiving or describing biometric data, and the blurred frame is what gets processed — never the original.

**Voices:** Voice anonymization (pitch shift + formant modification) before Whisper transcription is technically possible but uncommon in practice. The more pragmatic position: document the limitation, note that Whisper's output is text (not audio), and apply standard PII redaction on the transcript. The raw audio is not stored beyond the Whisper API call.

**Portfolio scope answer:** implement frame-level `redactPii` on GPT-4o text output (catches OCR-visible PII like email addresses or SSNs in video frames) and call out AWS Rekognition face blurring as the production addition. The gap is documented — it is not a silent omission.

### Why Not SQS or a Separate Lambda for Video?

Same reason as the main pipeline: LangGraph handles node orchestration; Inngest handles job lifecycle. Video is a wider input to the same graph, not a different workflow. The `videoNode` would be a parallel branch in the existing graph — no new infrastructure required.

### Cost Consideration

Video is meaningfully more expensive than single modalities: it invokes both GPT-4o (frames) and Whisper + Claude Sonnet (audio track), plus the keyframe sampling compute. At demo scale with a $15/month ceiling, video jobs would need to count against a tighter per-job budget. A reasonable constraint: 1 video job ≈ 3 standard jobs in the rate limiter.

**Related:** [HARDENING_ROADMAP.md — Future Modalities](./HARDENING_ROADMAP.md#future-modalities)

---

## 26. Circuit Breaker and Iteration Cap — Current Gap and Production Fix

### Context

Spectra's LangGraph pipeline is not a reasoning loop — it is a directed acyclic pipeline: `routerNode → [documentNode ‖ visionNode ‖ audioNode] → synthesisNode → auditorNode`. Each job traverses the graph exactly once. There is no cycle. For this reason, an application-level iteration cap is not required.

However, two production risks are currently unaddressed:

---

### Risk 1 — No explicit `recursionLimit`

The graph is compiled without a `recursionLimit`:

```typescript
.compile({ checkpointer })
```

LangGraph defaults to 25 steps. The current pipeline uses ~6 steps per job. If a graph bug introduced a cycle (e.g., a conditional edge that routes back to `routerNode`), the default of 25 would be the only backstop — not 6 as intended.

**Fix:**

```typescript
// In the Lambda handler invoking the graph:
const result = await spectraGraph.invoke(input, {
  configurable: { thread_id: jobId },
  recursionLimit: 8,  // tight ceiling: 6 nodes + 2 headroom
});
```

This makes the expected step budget explicit and catches graph regressions immediately rather than silently exhausting the default budget.

---

### Risk 2 — No circuit breaker around external model API calls

Each job calls up to 5 external model APIs: Bedrock Nova Micro, Claude Sonnet (×2), GPT-4o (×2 vision/audit), Whisper. If one provider is degraded, the node will throw. Inngest handles retries at the job level (retries the entire Lambda invocation), but there is no node-level circuit breaker — a degraded provider gets hammered on every retry.

**What a circuit breaker looks like here:**

Unlike VanguardAgent (where the circuit breaker lives in graph state and the supervisor node), Spectra's natural circuit breaker layer is in each node's error handler — catch provider errors, classify them, and decide whether to retry or degrade gracefully.

```typescript
// In documentNode.ts (pattern for all nodes):
async function documentNode(state: SpectraStateType) {
  try {
    const result = await callBedrock(state.documentText);
    return { documentFindings: result };
  } catch (err) {
    if (isProviderUnavailable(err)) {
      // Circuit trips: degrade gracefully instead of throwing
      return {
        documentFindings: null,
        warnings: [`documentNode: Bedrock unavailable — findings skipped. ${err.message}`],
      };
    }
    throw err; // Unknown errors still propagate to Inngest for retry
  }
}
```

The synthesis and auditor nodes already handle `null` modality inputs — so a degraded node producing `null` findings rather than throwing is architecturally supported. The job completes with a partial result and a warning, rather than failing entirely.

**Current state vs production target:**

| | Current | Production target |
|---|---|---|
| `recursionLimit` | LangGraph default (25) | Explicit `8` in `invoke()` |
| Provider error handling | Node throws → Inngest retries full job | Node degrades gracefully → job completes with partial result + warning |
| Tool-error circuit breaker | None | Per-node try/catch with provider-error classification |

**See also:** HARDENING_ROADMAP.md — §1 System Design gap ("No circuit breakers around external model APIs")

---

## 27. Agentic RAG in documentNode — Static Retrieval vs. Tool-Driven Retrieval

### Context

`documentNode` currently implements **static RAG**: chunk the PDF, embed all chunks, pick the top-5 by cosine similarity to the document head, and pass those 5 chunks to Claude Sonnet in a single prompt. Claude has no ability to ask for more context — it works with whatever the heuristic retrieval returned.

### The Limitation

The retrieval query is hardcoded to the document's first 1000 characters (see Section 23). Claude cannot steer what it reads. If the 5 retrieved chunks happen to be boilerplate headers or an unrelated section, Claude extracts findings from them regardless. There is no feedback loop between the model's reasoning and the retrieval step.

### What Agentic RAG Looks Like Here

Replace the single `anthropic.messages.create` call with a **tool-use loop**. Claude is given a `retrieve(query: string)` tool backed by the in-memory `embeddedChunks` array. It can issue multiple targeted queries before deciding it has enough context:

```
chunks embedded in memory
  ↓
Claude receives system prompt + retrieve() tool
  ↓
Claude: tool_use { name: "retrieve", input: { query: "revenue figures Q3" } }
  → cosine similarity against embeddedChunks → return top-3 chunks
Claude: tool_use { name: "retrieve", input: { query: "risk factors section" } }
  → cosine similarity against embeddedChunks → return top-3 chunks
Claude: stop_reason: "end_turn" — emit findings + citations
```

The model decides **what to look for** and **when it has enough** — that is the agent part. The vector store is the same in-memory cosine similarity function already in the file (no Upstash reads, no eventual-consistency risk).

### Trade-offs

| Dimension | Static RAG (current) | Agentic RAG |
| :--- | :--- | :--- |
| **LLM calls per job** | 1 | 2–5 (tool loop iterations) |
| **Tokens per job** | ~5k (5 chunks + prompt) | Higher — each round-trip includes prior context |
| **Retrieval quality** | Fixed top-5, query heuristic | Model-directed; adapts to document structure |
| **Determinism** | High — same query always returns same top-5 | Lower — tool call sequence varies |
| **Cost** | ~$0.015/job (Sonnet) | ~$0.03–0.06/job depending on loop depth |
| **Complexity** | Single `messages.create` call | Tool-use loop with `stop_reason` check |

### Why It Is Not Yet Implemented

At portfolio scale (demo account, $15/month ceiling), the cost difference per job is acceptable but the added complexity is not warranted for the current retrieval heuristic. The document-head heuristic works well for the structured PDFs the demo targets (reports, analyses, financial documents with representative openings).

Agentic RAG becomes the right choice when:
1. Retrieval gaps appear — critical facts in the document's conclusion are consistently missed in synthesis
2. Document variety increases — unstructured PDFs, legal contracts, or multi-section reports where the opening is boilerplate
3. The pipeline is extended with an explicit user query (e.g., "summarise the risk section") — at that point, using Claude to issue targeted retrieval against that query is the natural fit

### Implementation Shape (if adopted)

The chunking, embedding, and in-memory `embeddedChunks` array are unchanged. Only the lower half of `documentNode.ts` changes — the `anthropic.messages.create` call is replaced with a tool-use loop:

```typescript
const tool = {
  name: "retrieve",
  description: "Retrieve the most relevant chunks from the document by semantic query.",
  input_schema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
};

let messages = [{ role: "user", content: "Analyse this document and extract findings..." }];
while (true) {
  const response = await anthropic.messages.create({ model, tools: [tool], messages });
  if (response.stop_reason === "end_turn") break;
  // Handle tool_use blocks: run cosine similarity, append tool_result
  messages = [...messages, { role: "assistant", content: response.content }, toolResultBlock];
}
```

No new infrastructure. The `retrieve` function is a closure over `embeddedChunks` and the existing `cosineSimilarity` helper.

**File:** `apps/spectra-api/src/graph/nodes/documentNode.ts`

---

## 28. Supabase Keepalive — Migration from Vercel Cron to pg_cron

### Context

Supabase free-tier projects are paused after 7 days of database inactivity. The original keepalive strategy used a Vercel cron (`0 9 * * *` in `apps/spectra-app/vercel.json`) that hit a Next.js API route (`GET /api/keepalive`), which in turn issued a raw PostgREST `fetch()` to `/rest/v1/jobs?select=id&limit=1` with the service key.

### Challenge

The Vercel cron approach had two failure modes: (1) if the Vercel deployment was paused, misconfigured, or the `SUPABASE_SERVICE_KEY` env var was missing, the keepalive silently stopped firing; (2) Vercel's free hobby plan does not guarantee cron execution frequency — it rate-limits and may skip invocations. Both cases result in Supabase suspension without any observable signal in the app itself.

### Solution

The keepalive now runs as a `pg_cron` job **inside Supabase's own Postgres infrastructure**, registered once via the SQL Editor:

```sql
create extension if not exists pg_cron;

select cron.schedule(
  'supabase-keepalive',
  '0 12 */3 * *',
  $$select count(*) from jobs$$
);
```

The job fires at noon UTC every 3 days — well within the 7-day suspension window — and requires no external caller. `pg_cron` is a first-party Supabase extension available on all plans.

**Removed:** `apps/spectra-app/app/api/keepalive/route.ts` (dead code — nothing calls it), and the `crons` array from `apps/spectra-app/vercel.json`.

**Why pg_cron is strictly better here:** The scheduler runs in the same Postgres process as the data; it cannot fail due to app deployment state, Vercel plan limits, or missing environment variables. The job is durable — it survives database restarts and persists across Supabase maintenance events.

**Verify job registration:**
```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'supabase-keepalive';
```

**Check execution history:**
```sql
select status, start_time, return_message
from cron.job_run_details
order by start_time desc
limit 5;
```

