# Spectra AI — Technical Advisory

This document records the implementation challenges encountered during development, the root-cause analysis for each, and the solutions applied. It serves as an engineering reference for understanding non-obvious design choices in the codebase.

---

## 1. LangGraph Checkpointing Inside a Lambda Cold Start

### Context

`jobProcessor` runs a full LangGraph `StateGraph` inside a Lambda invocation. LangGraph supports optional checkpointing so that a crashed run can resume from its last completed node rather than starting over.

### Challenge

Lambda functions are stateless and ephemeral. The default in-memory checkpointer is destroyed when the invocation ends, making it useless for cross-invocation resume. A naive Upstash Redis checkpointer instantiated at module scope re-creates a client on every cold start and leaves TCP connections open after the handler returns — causing Lambda to bill for idle time and occasionally hang on teardown.

### Solution

The Redis checkpointer client is initialised lazily inside the graph factory function, not at module scope. The connection is explicitly closed in a `finally` block after the graph run completes. Checkpointing is keyed by `jobId` so that Inngest retries land on the same checkpoint namespace and skip already-completed nodes.

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

---

## 3. Inngest Event Deduplication — S3 Trigger + Frontend Trigger

### Context

The upload pipeline fires an Inngest event from two places: `POST /api/upload` (frontend, immediately after the job record is created) and `ingestHandler` (Lambda, on S3 `ObjectCreated`). This is intentional — the S3 trigger is a safety net in case the frontend call fails mid-flight.

### Challenge

If both succeed, `jobProcessor` runs twice for the same job. The second run overwrites the `confidence_scores` and `governance_trace` in Supabase with a second (different) LLM response — producing non-deterministic results and doubling Lambda + LLM cost.

### Solution

Inngest event deduplication via `idempotencyKey`: both triggers send the event with `id: jobId`. Inngest deduplicates on that key within a 24-hour window — the second event is dropped silently. The frontend trigger is always first; the S3 trigger fires only if the frontend trigger never arrived.

**File:** `apps/spectra-app/app/api/upload/route.ts`, `apps/spectra-api/src/handlers/ingestHandler.ts`

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

The Supabase probe uses a raw `fetch()` to `${url}/rest/v1/` with the `apikey` header set to the anon key. A 200 response indicates the Supabase REST layer is alive. No SDK, no WebSocket, no client state. The Redis probe uses Upstash's REST API at `/ping` — returns `{ result: "PONG" }` on success. Both probes are wrapped in a 4-second `AbortSignal.timeout` to prevent the health handler from hanging.

**Files:** `apps/spectra-app/lib/health-probes.ts`, `apps/spectra-app/app/api/health/route.ts`

---

## 6. Lambda Concurrency Cap — Removed at Deploy (Phase 5)

### Context

`jobProcessor` invokes Bedrock (Nova Micro), Anthropic SDK (Claude Sonnet ×2), and OpenAI SDK (GPT-4o ×2, Whisper ×1) per job. At portfolio-demo scale, the real cost risk is runaway parallelism, not throughput.

### Challenge

Without a concurrency limit, a burst of upload requests (e.g. a recruiter sharing the demo link) could spin up 20+ simultaneous Lambda executions, each making 6 LLM API calls. The CloudWatch $15/month billing alarm is the last line of defence — not a first-line cost guard.

### Solution

`reservedConcurrentExecutions: 1` was the intended CDK configuration. At deploy time, AWS rejected it: new accounts have a default regional concurrency limit of 10, and reserving 1 would drop the unreserved pool below AWS's enforced minimum of 10.

The setting was removed. Cost protection at portfolio scale is provided by two other mechanisms already in place: the Upstash rate limiter (3 req/day/IP on `/api/upload`) and the CloudWatch billing alarm ($20/month). The concurrency cap was belt-and-suspenders — not the primary guard.

To re-enable it: request a Lambda concurrency limit increase via AWS Support (Service Quotas → Lambda → Concurrent executions), then restore `reservedConcurrentExecutions: 1` in `compute-stack.ts` and redeploy.

**File:** `apps/spectra-api/lib/stacks/compute-stack.ts`

---

## 7. PII Redaction Before Vectorisation

### Context

The Document Agent chunks and vectorises PDF content. Upstash Vector stores embeddings with their source text as metadata. If the PDF contains names, email addresses, or identification numbers, that text would be stored verbatim in the vector index.

### Challenge

Redaction must happen before `upsert()` — not after. Post-hoc deletion from a vector index is unreliable because embeddings already carry semantic signal about the original text, and there is no guarantee all fragments are found and removed.

### Solution

PII patterns (email, phone, SSN, credit card, full name heuristics) are stripped from each chunk using regex substitution in `documentNode` before the embedding call. The redacted text is what gets embedded and stored as metadata. The unredacted text is never written to Upstash. The synthesis report is generated from the redacted chunks — the auditor scores the redacted synthesis, not the original.

**File:** `apps/spectra-api/src/graph/nodes/documentNode.ts`

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
const MockRatelimit = function Ratelimit() { return { limit: mockLimit }; };
MockRatelimit.slidingWindow = vi.fn().mockReturnValue({});
```

Extract `mockSend` and `mockLimit` as module-level `vi.fn()` refs so individual tests can override return values without redefining the mock. Remove `vi.resetModules()` from `beforeEach` — it invalidates module-level mock refs and causes the constructor reference to diverge from the test's captured ref.

**File:** `apps/spectra-app/tests/api/upload/route.test.ts`

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

`documentNode` and `audioNode` both run `detectPromptInjection()` on extracted text. `visionNode` does not.

### Challenge

An attacker could embed injection text in a screenshot or image. Should `visionNode` check something?

### Solution

`visionNode` sends raw image bytes (base64-encoded) directly to GPT-4o's vision API — there is no intermediate text extraction step before the model call. GPT-4o's system prompt constrains the output format; the model receives the image, not text derived from it. Adding a vision OCR step solely to run the injection check would add latency and cost with marginal benefit — GPT-4o's own safety guardrails handle injected image text. The injection surface in this pipeline is user-supplied text (PDFs, audio), not images.

**File:** `apps/spectra-api/src/graph/nodes/visionNode.ts`

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
