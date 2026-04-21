# Spectra AI — Hardening Roadmap

Items that would move Spectra AI from a portfolio demo to a production-quality application. Ordered by risk impact, not implementation complexity.

**Reading the Effort column:**
- ~~Strikethrough description~~ **Done** — the item has been implemented. The original description is preserved for context.
- ~~Medium~~ ✅ — original effort estimate, now complete.
- Plain text effort — item is still pending.

Each item is tagged with the AI Engineering skill it strengthens. See the [AI Engineering Maturity Snapshot](#ai-engineering-maturity-snapshot) at the bottom for grades and improvement paths.

---

## Infrastructure & Compute

| Item | Why | Skill | Effort |
| :--- | :--- | :--- | :--- |
| **Lambda Concurrency Cap** | `reservedConcurrentExecutions` removed at deploy — new AWS accounts cannot reserve below 10 unreserved concurrency. A burst of uploads could run parallel LangGraph pipelines, stacking Bedrock + OpenAI + Anthropic costs. Request a Lambda concurrent executions limit increase via AWS Service Quotas (minimum: raise regional limit to 20+). Once approved, restore `reservedConcurrentExecutions: 1` in `compute-stack.ts` and redeploy. Rate limiter (3 req/day/IP) is the current mitigating guard. | 4 · Reliability Engineering | Low — AWS Support quota request |
| **Lambda Cold Start Mitigation** | `jobProcessor` cold start adds 3–5s to the first invocation after idle. Enable Lambda Provisioned Concurrency (1 instance) during peak demo hours, or add a scheduled CloudWatch Event that pings the function every 5 minutes. At portfolio scale, the 5-minute ping is sufficient. | 4 · Reliability Engineering | Low |

---

## Security & Authentication

| Item | Why | Skill | Effort |
| :--- | :--- | :--- | :--- |
| **CORS Origin Locking** | S3 bucket CORS allows `https://*.vercel.app` and `http://localhost:3000`. After assigning a custom domain to the Vercel deployment, update `storage-stack.ts` to allow only that domain. Remove the wildcard `*.vercel.app` entry. | 5 · Security & Safety | Low — one config change + redeploy |
| **JWT Token Expiry + Refresh** | Tokens issued by `/api/auth/token` have no expiry. A stolen token is valid indefinitely. Add `expiresIn: "8h"` to the JWT sign call. Implement a `/api/auth/refresh` route. Store refresh tokens in Supabase with revocation support. | 5 · Security & Safety | Medium |
| **S3 Bucket Policy + Signed URLs** | Files are uploaded server-side from the Vercel function using service credentials. For user-facing uploads at scale, replace `PutObjectCommand` with pre-signed S3 URLs — the browser uploads directly, reducing Vercel function memory pressure and egress cost. | 5 · Security & Safety | Medium |
| **Rate Limit Scope** | Rate limit applies per IP at `/api/upload` only. Extend to `/api/auth/token` (e.g. 10 attempts/hour/IP) to prevent credential stuffing against the demo account. Upstash sliding window is already in place — it is a one-line addition. | 5 · Security & Safety | Low — one-line addition |
| ~~**Prompt Injection Detection**~~ | ~~User-supplied file content (PDF text, audio transcripts) is fed into Claude and GPT-4o. Malicious content could attempt to override agent instructions and manipulate pipeline output.~~ **Done** — `detectPromptInjection()` in `src/lib/prompt-injection.ts` runs 14 regex patterns on extracted PDF text (documentNode) and Whisper transcripts (audioNode) before any LLM call. Vision node is exempt — raw image bytes carry no injection surface. Job fails with a structured error if triggered. | 5 · Security & Safety | ~~Medium~~ ✅ |
| ~~**Synthesis Output Guardrails**~~ | ~~No validation that the synthesis report itself is safe or well-formed before it is passed to the auditor and written to Supabase.~~ **Done** — `validateSynthesisReport()` in `synthesisNode.ts` checks minimum report length, re-runs injection detection on the LLM output, and warns to CloudWatch if no inline citation tags are present despite active modalities. | 5 · Security & Safety | ~~Low~~ ✅ |
| **PII Redaction Coverage Audit** | Regex patterns cover email, phone, SSN, credit card, and full-name heuristics. Run redaction against a wider corpus to identify gaps. Consider replacing regex with a dedicated NER model (e.g. spaCy or AWS Comprehend) for higher recall. Audit that `redactedFields` in the Document node output accurately reflects everything removed. | 5 · Security & Safety | Medium |

---

## Observability & Monitoring

| Item | Why | Skill | Effort |
| :--- | :--- | :--- | :--- |
| **Sentry Source Maps** | `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are not configured. Stack traces in Sentry show minified code. Create a Sentry internal integration, generate `SENTRY_AUTH_TOKEN`, and add all three vars to Vercel env vars. Source map upload is already gated on `NODE_ENV === "production"` in `next.config.ts`. | 6 · Evaluation & Observability | Low — env var setup only |
| **CloudWatch Log Metric Filters** | CloudWatch logs exist for both Lambdas but no structured alerting on error patterns. Add `MetricFilter` constructs in `ObservabilityStack` for `[ERROR]` log patterns on both functions. Wire alarms to the existing `billingAlertTopic` SNS topic or a separate ops topic. | 6 · Evaluation & Observability | Low — CDK additions |
| ~~**LangSmith Evaluators**~~ | ~~No systematic measurement of output quality across runs. No way to detect prompt regressions or model degradation over time.~~ **Done** — `faithfulness` evaluator scores `overallFaithfulness / 100` from the auditor output; `citation_accuracy` scores high-confidence findings (≥70%) against total governance trace entries. Both log as structured JSON to CloudWatch (`[langsmith-evaluators]` prefix) after every completed job run. | 6 · Evaluation & Observability | ~~Medium~~ ✅ |
| ~~**NIST AI RMF Control IDs**~~ | ~~Governance trace entries carried only four function-level tags (GOVERN / MAP / MEASURE / MANAGE) with no specific control reference. Insufficient for a credible AI governance story.~~ **Done** — `AuditorOutputSchema.governanceTrace` extended with optional `nistControlId` field (e.g. `MEASURE 2.1`). Auditor prompt includes a 10-entry NIST AI RMF control reference table. GovernanceTrace UI displays the full control ID when present, with hover tooltip. | 6 · Evaluation & Observability | ~~Medium~~ ✅ |

---

## Data & Storage

| Item | Why | Skill | Effort |
| :--- | :--- | :--- | :--- |
| **Upstash Vector Cleanup on Job Failure** | Document chunks are deleted from Upstash Vector on job completion. If a job fails mid-pipeline, vectors from a partial `documentNode` run may be orphaned, causing unbounded vector index growth. Add a cleanup step in `failJob()` that deletes any vectors under `{jobId}/{userId}/` regardless of pipeline completion state. | 3 · Retrieval Engineering | Low |

---

## AI / LLM Integrity

| Item | Why | Skill | Effort |
| :--- | :--- | :--- | :--- |
| ~~**Citation Deep-Linking**~~ | ~~Citation badges `[D1]`/`[V1]`/`[A1]` in the synthesis report were static spans with no interactivity. Users had no way to trace a claim back to its source modality.~~ **Done** — citation badges are now interactive `<button>` elements in `SynthesisPanel`. Clicking opens a tooltip showing modality type and source description. Fully keyboard-accessible (Enter/Space/Escape). | 7 · Product Thinking | ~~Low~~ ✅ |

---

## Update Rules

Add entries when a known limitation is accepted at demo-scale that would need to be resolved before a production launch. Mark `[RESOLVED]` or apply strikethrough + ✅ when addressed.

---

## AI Engineering Maturity Snapshot

Grading Spectra AI against the 7 core AI engineering skills. Scale: **Strong** / **Partial** / **Weak** / **Not present**.

| Skill | Grade | What is in place | What is still missing |
| :--- | :--- | :--- | :--- |
| **1. System Design** | Partial | Clean pipeline architecture (S3 → Lambda → LangGraph → Supabase). Three independent CDK stacks with explicit dependency order. Inngest owns job lifecycle and retries — Lambda does not retry internally. LangGraph checkpointing keyed by `jobId` so Inngest retries resume from the last completed node. Modular node files, single-source Zod schemas. | No circuit breakers around external model APIs. Lambda concurrency cap still pending AWS quota increase. No multi-user schema design — `user_id` FK exists but architecture is single-demo-account in practice. |
| **2. Tool & Contract Design** | Strong | Zod `.parse()` on every agent node boundary (input and output). All schemas centralised in `src/lib/schemas.ts` — imported by both API and frontend; never duplicated. `AuditorOutputSchema` extended with `nistControlId` for structured governance output. Synthesis output validated by guardrail after schema parse. JSON output enforced in every LLM prompt; markdown fence stripping before parse. | No versioned prompt artifacts — prompt changes are untracked in git history. No OpenAPI spec for Lambda HTTP endpoints. |
| **3. Retrieval Engineering** | Partial | Upstash Vector with session-namespaced embeddings (`{jobId}/{userId}/` prefix) — cross-job bleed is impossible. `text-embedding-3-small` embeddings chunked at 500 words with 50-word overlap. Top-5 RAG retrieval before Claude citation extraction. PII redaction applied before vectorisation — unredacted text is never written to the index. Vectors cleaned up on job completion. | Orphaned vectors on mid-pipeline failure (Upstash cleanup in `failJob()` not yet implemented). No hybrid search or BM25 fallback. No chunk quality scoring or retrieval eval. No cross-document deduplication. |
| **4. Reliability Engineering** | Partial | Inngest retries with exponential backoff — second `spectra/job.process` event is deduplicated via `idempotencyKey: jobId`. LangGraph checkpointing allows resume from last completed node on retry. Sentry `wrapHandler()` on both Lambda functions. CloudWatch $20 billing alarm as last-line cost guard. UptimeRobot monitoring `/api/health`. | Lambda concurrency cap removed (pending AWS quota increase). Lambda cold start adds 3–5s to first invocation. No CloudWatch metric filters or alarms on `[ERROR]` log patterns. No Sentry source maps — stack traces show minified code. |
| **5. Security & Safety** | Strong | JWT/RBAC middleware guards all `/dashboard` and `/api` routes. Supabase RLS — users can only read/write their own jobs. Rate limiting: 3 req/day/IP on `/api/upload` (Upstash sliding window). PII redaction (email, phone, SSN, credit card, full-name heuristics) before vectorisation and synthesis. `detectPromptInjection()` on all text-derived inputs before LLM calls. Synthesis output re-checked for injection patterns before auditor runs. Session-namespaced vector keys prevent cross-user data bleed. SUPABASE_SERVICE_KEY never exposed to client. | CORS still allows `*.vercel.app` wildcard — needs locking to production domain. JWT tokens have no expiry — stolen tokens valid indefinitely. S3 uploads server-side via service credentials rather than pre-signed URLs. PII regex patterns not audited against real-corpus edge cases. |
| **6. Evaluation & Observability** | Strong | LangSmith end-to-end tracing across all 6 agent nodes (`LANGCHAIN_TRACING_V2=true`). `faithfulness` and `citation_accuracy` evaluators computed and logged to CloudWatch after every completed job. NIST AI RMF control IDs (`GOVERN 1.1`, `MEASURE 2.1`, etc.) on every governance trace entry. Sentry error capture on Lambda + Next.js client + server + edge. LLM-as-Judge auditor scores each modality 0–100 for faithfulness with hallucination list. Synthesis guardrail warns to CloudWatch on missing citation tags. | No Sentry source maps — Lambda and Next.js stack traces show minified code. No CloudWatch metric filter alarms on `[ERROR]` patterns. LangSmith evaluators log to CloudWatch only — not yet pushed as LangSmith `createFeedback` calls against run IDs. |
| **7. Product Thinking** | Strong | Demo account with publicly visible credentials — recruiters can use the app without friction. Preset sample files on the dashboard. 3-modality parallel processing (document, vision, audio) with real-time agent graph visualisation. Per-modality confidence bars from the LLM-as-Judge auditor. Citation badges `[D1]`/`[V1]`/`[A1]` are interactive — click to see source modality and description. Governance trace with NIST control IDs surfaces AI accountability story. Hard $20/month billing ceiling protects demo viability. | Citation deep-linking shows modality type but not the actual source chunk text (synthesis citations not persisted to Supabase). No job history page with per-run report comparison. No streaming synthesis output — report appears after full pipeline completion. |
