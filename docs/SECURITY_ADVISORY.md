# 🥊 Spectra AI — Security Advisory

This advisory documents security behaviors observed in Spectra AI under structured adversarial testing, including prompt injection attempts embedded in user-supplied documents, PII redaction coverage verification, and synthesis output integrity validation.

Findings are grounded in reproducible test executions (`red-team.redteam.test.ts`) and are traceable to specific library controls in `src/lib/`.

> **Scope note:** This advisory reports evidence-based outcomes from tested scenarios. It is not a claim of universal security against all prompts, models, document types, or deployment conditions.

---

## Scope

**Test coverage:**

- `apps/spectra-api/src/__tests__/red-team.redteam.test.ts` — 79 adversarial tests across four suites (120 total in the API test suite)

**Security surface under test:**

- `src/lib/prompt-injection.ts` — 14-pattern injection detection, case-insensitive, all text-derived inputs
- `src/lib/pii-redaction.ts` — 11-pattern PII redaction before vectorization and synthesis
- `src/lib/synthesis-guardrails.ts` — post-parse output integrity validation before auditor execution

**Governed pipeline paths:**

- `documentNode` — PDF text injection-checked and PII-redacted before any LLM call
- `audioNode` — Whisper transcript injection-checked and PII-redacted before any LLM call
- `visionNode` — GPT-4o text output PII-redacted and injection-checked (`detectPromptInjection()`) before graph state
- `synthesisNode` — LLM output re-checked before passing to auditor and Supabase write

**Evidence surface:**

- Structured runtime logs (CloudWatch)
- LangSmith end-to-end traces per job run
- Sentry error capture on Lambda and Next.js boundary

---

## 1) Prompt Injection Detection

### Attack pattern

User-supplied PDF content or audio transcripts contain adversarial instruction fragments designed to override agent system prompts — e.g. "ignore previous instructions", "you are now a different AI", jailbreak tokens, model-specific prompt delimiters (`[INST]`, `<|im_start|>`), and instruction headers (`### Instructions`).

### Defensive behavior observed

- `detectPromptInjection()` runs 14 compiled regex patterns against all text-derived inputs before any LLM call.
- Detection is case-insensitive — `IGNORE PREVIOUS INSTRUCTIONS` and `Ignore Previous Instructions` both trigger.
- Injection phrases buried inside otherwise legitimate document text are detected (e.g. financial memos containing embedded override fragments).
- Multiline injection across document line breaks is detected.
- Clean document text, including legitimate uses of "instructions", "system", and "new" in normal financial/technical contexts, passes without false positives.

### Expected outcomes

- Job fails with a structured error before any LLM call if injection is detected in uploaded content.
- Clean documents proceed to the pipeline unaffected.
- Detection returns a `reason` string on failure for log traceability.

---

## 2) PII Redaction Coverage

### Attack pattern

User-supplied content containing personally identifiable information — across documents, audio transcripts, and vision model output — flows into the vectorization and synthesis pipeline without redaction.

### Defensive behavior observed

- `redactPii()` runs eleven regex patterns across all three text-producing modalities: `documentNode` (before vectorisation), `audioNode` (transcript before Claude Sonnet), `visionNode` (GPT-4o text output before graph state).
- Each matched field is replaced with a typed placeholder: `[REDACTED:EMAIL]`, `[REDACTED:PHONE_US]`, `[REDACTED:PHONE_INTL]`, `[REDACTED:IBAN]`, `[REDACTED:SSN]`, `[REDACTED:CREDIT_CARD]`, `[REDACTED:UK_NINO]`, `[REDACTED:DOB]`, `[REDACTED:DOB_ISO]`, `[REDACTED:ADDRESS]`, `[REDACTED:PERSON_NAME]`.
- IBAN pattern is ordered before `phone_us` to prevent digit-sequence overlap between the two patterns.
- `redactedFields` accurately reports which types were found — no false positives on clean financial text, no duplicate labels when multiple instances of the same type appear.
- Unredacted text is never written to the Upstash Vector index or forwarded to LLM providers.

### Expected outcomes

- PII types are replaced before vectorization, before LLM prompt construction, and before graph state propagation.
- Clean text passes through unchanged with an empty `redactedFields` array.

---

## 3) Synthesis Output Guardrails

### Attack pattern

The LLM synthesis output itself contains injection fragments, is malformed/empty, or lacks grounding citation tags despite active modalities — potentially propagating adversarial content to the auditor and the Supabase job record.

### Defensive behavior observed

- `validateSynthesisReport()` runs post-parse, before the auditor receives the report.
- Reports shorter than 100 characters are rejected — catches silent LLM failures.
- `detectPromptInjection()` is re-run on the LLM output itself — injection in the synthesis response is caught before it propagates.
- Reports with active modalities but no inline citation tags (`[D1]`, `[V1]`, `[A1]`) trigger a CloudWatch warning — a grounding failure signal without blocking the job.

### Expected outcomes

- `Error: Synthesis report too short` for empty or minimal LLM output.
- `Error: Synthesis output failed safety check` if the LLM output contains injection patterns.
- `console.warn` to CloudWatch if citation tags are missing despite active modalities.
- Valid, well-grounded reports pass through without modification.

---

## 4) Security Status Mapping

Spectra security control paths are mapped to deterministic HTTP status codes:

| Status | Meaning                                                                                                        |
| :----- | :------------------------------------------------------------------------------------------------------------- |
| `400`  | Malformed request payload, unsupported file type, schema parse failure                                         |
| `401`  | Missing or invalid JWT — all `/dashboard` and `/api` routes                                                    |
| `404`  | Job not found or does not belong to the requesting user                                                        |
| `409`  | Upload confirm attempted on a job already in progress or completed                                             |
| `429`  | Rate limit exceeded — upload (3/day/IP), auth/token (10/hr/IP), auth/refresh (5/min/IP), job reads (60/min/IP) |
| `500`  | Pipeline error with structured error message and Sentry capture                                                |

Injection detection and PII redaction failures surface as `500` job errors with structured log output — they are not user-facing HTTP status codes since they occur inside the Lambda pipeline, not at the API boundary.

---

## 5) Production vs Non-Production Runtime Strictness

Spectra enforces environment-aware behavior:

- **Non-production / CI:**
  - Health endpoint returns `200` with `status: degraded` when dependency probes are missing or unavailable.
  - Injection detection and PII redaction are active in all environments — no CI bypass.
- **Production:**
  - Health endpoint returns `503` when critical dependencies (`supabase`, `redis`) fail probes.
  - Lambda error alarms fire to SNS when `[ERROR]` patterns appear in CloudWatch logs.
  - Rate limiting (upload + auth) is enforced via Upstash in all environments.

---

## Security Positioning Statement

Spectra AI demonstrates adversarial resilience for tested injection, PII, synthesis integrity, and vision output scenarios, based on reproducible test evidence from `red-team.redteam.test.ts` (79 adversarial tests; 120 total API tests) and runtime behaviour controls active in both development and production.

**Open gaps (tracked in HARDENING_ROADMAP.md):** auditor fallback grants 75/100 silently on parse failure (PRIO); Unicode/encoding bypasses on regex injection detector (Medium); rate-limit IP header pinning (Medium); passport numbers and free-form person names require NER model (Medium).

This advisory is a bounded security statement and should be maintained as the test suite, pipeline architecture, and threat model evolve.

---

## Maintenance Notes

Update this advisory whenever any of the following change:

- `detectPromptInjection()` pattern set or matching logic
- `redactPii()` pattern set or PII type coverage
- `validateSynthesisReport()` validation rules or thresholds
- Pipeline nodes that receive user-supplied text (document, audio, or future modalities)
- Security status code mapping at API boundaries
- Red team suite scope or test evidence sources
