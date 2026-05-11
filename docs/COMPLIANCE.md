# Compliance & Governance

**Spectra AI is designed with regulatory and ethical compliance as first-class concerns. This document covers the regulatory landscape, compliance mechanisms, and governance artifacts that demonstrate Spectra's adherence to AI, data protection, and security regulations.**

## Contents

1. [Regulatory Landscape](#regulatory-landscape)
2. [Spectra Compliance Mechanisms](#spectra-compliance-mechanisms)
3. [Model Governance & Model Cards](#model-governance--model-cards)
4. [Data Governance](#data-governance)
5. [Audit Trail & Traceability](#audit-trail--traceability)
6. [Risk Assessment Framework](#risk-assessment-framework)

---

## NIST AI Risk Management Framework (AI RMF)

Spectra AI is architected around **NIST AI RMF**, a governance framework that organizes AI risk management into four core functions:

| Function | Purpose | Spectra Implementation |
| :--- | :--- | :--- |
| **GOVERN** | Establish accountability & organizational structures for AI risk | Model selection rationale documented; governance trace captures policy decisions |
| **MAP** | Identify & document AI system risks in context | Router classifies modalities; specialist agents scope scope/purpose; model cards document capabilities + limits |
| **MEASURE** | Evaluate AI system performance & measure risk | LLM-as-Judge Auditor scores faithfulness (0–100); hallucination detection; confidence scores per modality; citation accuracy metrics |
| **MANAGE** | Implement controls & address identified risks | PII redaction (5 patterns); prompt injection detection (14 patterns); synthesis validation gates; rate limiting; RLS; audit trail |

### Governance Trace & NIST Control IDs

Every job execution produces a **governance trace** — a decision log where each finding is tagged with a NIST function + specific control ID:

```json
{
  "timestamp": "2026-05-06T14:32:45Z",
  "agent": "document",
  "finding": "Q4 budget approved with dual-sign approval",
  "confidence": 95,
  "nistTag": "GOVERN",
  "nistControlId": "GOVERN 1.1"
}
```

**NIST Control Reference:**

**GOVERN (Governance & Accountability)**
- `GOVERN 1.1` — Policies and accountability structures for AI risk are established
- `GOVERN 1.2` — Roles and responsibilities for AI risk management are defined

**MAP (Mapping & Risk Identification)**
- `MAP 1.1` — Context and purpose of the AI system are documented
- `MAP 2.1` — Scientific and domain expertise informs AI development
- `MAP 3.5` — Practices for identifying AI system risks are applied

**MEASURE (Measurement & Evaluation)**
- `MEASURE 1.1` — Measurement and evaluation approaches are established
- `MEASURE 2.1` — Grounding and factual accuracy of AI outputs is assessed
- `MEASURE 2.5` — Hallucination and confabulation risks are tracked

**MANAGE (Management & Control)**
- `MANAGE 1.1` — Risk treatment decisions are made and documented
- `MANAGE 2.2` — Residual risks and accepted uncertainties are tracked

Every agent finding is automatically assigned a NIST control ID by the Auditor, creating an audit trail that maps directly to NIST AI RMF governance requirements. This enables compliance auditors to trace from a specific job finding → NIST control ID → risk mitigation evidence (e.g., "hallucination detected → MEASURE 2.5 tracked → auditor output logged").

---

## Regulatory Landscape

Spectra AI operates in a multi-jurisdictional landscape with overlapping compliance requirements. NIST AI RMF provides the governance foundation; regulatory frameworks build on top:

### GDPR (General Data Protection Regulation)

**Applies to:** Any user data processed in the EU or involving EU residents.

**Key Requirements:**
- **Lawful basis** — explicit user consent before processing
- **Data minimization** — collect only necessary data
- **Right to access** — users can request their data
- **Right to erasure** — users can request deletion
- **Data protection impact assessment (DPIA)** — required for high-risk processing
- **Breach notification** — 72-hour notification to supervisory authority

**Spectra Implementation:**
- JWT/Supabase Auth gate — users must authenticate (lawful basis: contract)
- PII redaction before processing — only `[EMAIL]`, `[PHONE]` masks stored
- Supabase RLS — users read/write only their own jobs
- Job deletion endpoint available (future: automatic cleanup after 90 days)
- Error handling with PII stripping before Sentry (no data exfiltration)
- DPIA candidate: multi-modal AI processing of user documents

### EU AI Act (Artificial Intelligence Act)

**Applies to:** AI systems used in the EU; Spectra is not a high-risk category but shares architecture with regulated systems.

**Key Concepts:**
- **Risk-based approach** — high-risk systems require more rigorous safeguards
- **Transparency** — users must know they're interacting with AI
- **Human oversight** — critical decisions require human review
- **Documentation** — system purpose, training data, performance metrics

**Spectra Implementation:**
- **Risk tier:** Medium (multi-modal document analysis, not autonomous decision-making)
- **Transparency:** UI explicitly labels nodes as agents (Document Agent, Vision Agent, etc.)
- **Human-in-the-loop:** Governance trace + confidence scores inform user decision-making; no autonomous action
- **Documentation:** See [Model Governance](#model-governance--model-cards) (model cards, rationale per task)
- **Audit trail:** Complete trace of agent reasoning in governance trace with NIST AI RMF tags

### HIPAA (Health Insurance Portability & Accountability Act)

**Applies to:** Healthcare data in the US.

**Key Requirements:**
- **Encryption in transit & at rest**
- **Access controls** — principle of least privilege
- **Audit logs** — who accessed what, when
- **Business Associate Agreements (BAAs)** required for subprocessors

**Spectra Implementation:**
- Not HIPAA-certified; users must not upload protected health information (PHI)
- Warning on upload page: "Do not upload healthcare data or PII"
- If healthcare data is detected in future: redaction patterns can be extended
- Subprocessors (AWS, Anthropic, OpenAI) have public HIPAA compliance statements (user responsibility to negotiate BAAs)

### CCPA / CPRA (California Privacy Rights Act)

**Applies to:** California residents' personal information.

**Key Requirements:**
- Right to know, delete, opt-out, correct
- Disclosure of data sales (not applicable — Spectra does not sell data)
- Opt-out mechanisms for targeted advertising (not applicable)

**Spectra Implementation:**
- Supabase Auth + RLS provides access control
- User can request deletion via dashboard (future: implement automated CCPA request flow)
- No third-party data sharing (no Google Analytics tracking in app)

---

## Spectra Compliance Mechanisms

Spectra implements five core mechanisms to address regulatory requirements:

### 1. Consent & Lawful Basis

**Mechanism:** OAuth/JWT authentication + terms acceptance

| Step | Implementation | Requirement Met |
| :--- | :--- | :--- |
| User sign-up | Supabase Auth with email confirmation | GDPR: verifiable consent |
| ToS acceptance | Checkbox before first upload | GDPR: lawful basis (contract) |
| Data processing notice | Dashboard hint: "Your data is processed via Anthropic/OpenAI" | GDPR: transparency, Art. 13 |
| Opt-out available | Account deletion = data deletion (future: 90-day auto-cleanup) | GDPR: right to erasure |

---

### 2. Data Minimization & PII Redaction

**Mechanism:** Five-pattern masking before vectorization

| PII Type | Redaction | When Applied | Storage |
| :--- | :--- | :--- | :--- |
| Email | `[EMAIL]` | Before PDF chunking | Only masked version stored |
| Phone | `[PHONE_US]` | Before PDF chunking | Only masked version stored |
| SSN | `[SSN]` | Before PDF chunking | Only masked version stored |
| Credit Card | `[CARD]` | Before PDF chunking | Only masked version stored |
| UK NINO | `[NINO]` | Before PDF chunking | Only masked version stored |

**GDPR alignment:** Data minimization (Art. 5) — PII is masked before any processing, storage, or transmission to LLMs.

---

### 3. Row-Level Security (RLS) & Access Control

**Mechanism:** Supabase RLS policies on `jobs` table

```sql
CREATE POLICY user_can_read_own_jobs ON jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_can_write_own_jobs ON jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

- Users see only their own jobs
- No cross-user data leakage, even with database access
- Principle of least privilege enforced at database level

**GDPR alignment:** Confidentiality (Art. 32) + access control (Art. 25).

---

### 4. Audit Trail & Traceability

**Mechanism:** Governance trace + Sentry + LangSmith logging

| Event | Logged Where | Retention | Regulatory Purpose |
| :--- | :--- | :--- | :--- |
| Job created | Supabase `jobs` table | Indefinite | Prove user initiated processing |
| Agent findings | Governance trace (JSON) | Indefinite | Audit reasoning, NIST alignment |
| Confidence scores | Auditor output | Indefinite | Demonstrate quality gates |
| Errors & failures | Sentry (PII-stripped) | 90 days | Incident response, breach detection |
| Model calls | LangSmith traces | 1 year | Compliance audit, cost tracking |

**GDPR alignment:** Accountability (Art. 5) — "demonstrate compliance through documentation and audit logs."

---

### 5. Error Handling & Incident Response

**Mechanism:** Sentry + PII stripping + ops alerting

- All errors captured to Sentry
- PII redacted from stack traces before transmission
- CloudWatch billing alarm alerts on threshold breach
- Lambda timeout/failure logged with context (no user data exposed)

**GDPR alignment:** Breach notification — if a breach occurs, Sentry logs + CloudWatch metrics enable rapid incident assessment.

---

## Model Governance & Model Cards

Spectra deliberately matches model capability to task rather than defaulting to a single provider. Each model choice is justified, limitations documented, and bias mitigation considered.

### Model Selection Rationale

| Agent | Model | Reason | Limitations | Bias Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **Router** | Nova Micro (Bedrock) | Classification only — cheapest correct model, no reasoning needed | No multi-step reasoning; limited context window | Input validation + injection guard catches adversarial inputs |
| **Document** | Claude Sonnet | RAG + grounded citation extraction — core Anthropic strength | Hallucinations possible in synthesis; limited to 200K context | LLM-as-Judge auditor scores faithfulness; PII redaction before retrieval |
| **Vision** | GPT-4o | Best native image understanding available; non-negotiable for visual tasks | Image understanding varies by resolution, lighting, OCR accuracy | Multi-modal synthesis detects conflicts; vision findings compared against document/audio |
| **Audio** | Whisper → Sonnet | Transcription (Whisper) + structured extraction (Sonnet) | Whisper accuracy degrades with accents, background noise; Sonnet extracted from transcription not audio | Golden-set tests validate transcription quality; confidence scores reflect accuracy |
| **Synthesis** | GPT-4o | Multi-source merging and conflict resolution | Prone to hallucination when synthesizing conflicting sources | Conflict detection with `[CONFLICT: D1 vs V2]` flags; auditor scores grounding |
| **Auditor** | Claude Sonnet | Faithfulness + hallucination detection — Anthropic's core strength | LLM judging LLM output has inherent limitations (meta-reasoning) | Multiple evals (faithfulness + citation accuracy) provide triangulation; governance trace with confidence scores |

### Model Cards

Each model ships with operational context documented:

#### Document Agent (Claude Sonnet)

```
Model: claude-sonnet-4-6
Task: PDF parsing, chunking, PII redaction, RAG retrieval, citation extraction
Max tokens: 4,096 input context per request
Max output: 2,048 tokens
Cost: ~$0.003 / 1K input tokens
Latency: ~2–5s per job
Failure modes:
  - Hallucinated citations (sourced to non-existent page numbers)
  - Context window overflow on PDFs > 200 pages
  - False negatives on PII detection (some SSNs not caught)
Mitigation:
  - Auditor validates citations against source chunks
  - Document split into sub-PDFs if > 200 pages
  - 5-pattern PII regex + visual inspection of sensitive documents
```

#### Vision Agent (GPT-4o)

```
Model: gpt-4o (latest)
Task: Image analysis, entity extraction, bounding descriptions
Max input: 1 MB image
Cost: ~$0.015 / 1K tokens
Latency: ~3–7s per image
Failure modes:
  - OCR errors on low-resolution text
  - Hallucinated entities not visible in image
  - Struggles with non-Latin scripts
Mitigation:
  - Synthesis detects conflicts with document findings
  - Auditor scores per-modality confidence
  - Users advised to upload high-resolution images
```

#### Audio Agent (Whisper → Sonnet)

```
Model: Whisper (OpenAI) + Claude Sonnet (Anthropic)
Task: Audio transcription + structured extraction
Max input: 10 MB audio, < 30 seconds recommended
Cost: Whisper $0.02/min + Sonnet tokens
Latency: ~5–10s per audio file
Failure modes:
  - Whisper accuracy < 85% with heavy accents or background noise
  - Sonnet extraction misses context from intonation/emphasis
  - Silence or music mistranscribed as speech
Mitigation:
  - Users advised: clear speech, minimal background noise
  - Transcription confidence scores in governance trace
  - Synthesis layer merges audio with document/vision for grounding
```

---

## Data Governance

### Data Classification

| Data | Classification | Handling | Retention |
| :--- | :--- | :--- | :--- |
| **Job metadata** (user ID, created_at, modalities used) | Sensitive | RLS-protected, logged to Supabase | User account lifetime |
| **Original uploads** (PDF, image, audio) | Sensitive/PII | Scanned for injection, redacted for PII, stored in S3 versioned | 30 days (future: configurable) |
| **Chunks/vectors** | Low-sensitivity (PII masked) | Stored in Upstash Vector, session-namespaced | Job lifetime only |
| **Synthesis report** | Sensitive | RLS-protected, stored in Supabase, downloadable as PDF | User account lifetime |
| **Confidence scores** | Low-sensitivity | RLS-protected, visible on dashboard + PDF | User account lifetime |
| **Governance trace** | Sensitive | RLS-protected, contains agent reasoning + NIST tags | User account lifetime |
| **Error logs** | Sensitive (PII-stripped) | Sentry dashboard, anonymized | 90 days (Sentry retention) |
| **LangSmith traces** | Sensitive (contains I/O) | Private LangSmith project, operator-only access | 1 year (LangSmith retention) |

### Subprocessors & Third-Party Compliance

Spectra routes data to three external AI providers. Users must be aware:

| Subprocessor | Service | Compliance | User Responsibility |
| :--- | :--- | :--- | :--- |
| **Anthropic** | Claude Sonnet | SOC 2 Type II, GDPR Data Processing Agreement | Sign DPA if processing EU data |
| **OpenAI** | GPT-4o, Whisper, Embeddings | SOC 2 Type II, GDPR Data Processing Agreement | Sign DPA if processing EU data |
| **AWS (Bedrock)** | Nova Micro (router only) | SOC 2, GDPR, HIPAA BAA available | Sign BAA if processing healthcare data |

**Spectra responsibility:** Notify users that data is processed via these subprocessors (done via dashboard notice).

**User responsibility:** Sign Data Processing Agreements with subprocessors if required by regulation.

---

## Audit Trail & Traceability

### What Gets Logged

Every job produces an auditable record:

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "auth|user123",
  "createdAt": "2026-05-06T14:32:15Z",
  "modalities": { "document": true, "vision": true, "audio": false },
  "status": "completed",
  "confidenceScores": { "doc": 87, "vision": 92 },
  "synthesisReport": "...",
  "governanceTrace": [
    {
      "timestamp": "2026-05-06T14:32:45Z",
      "agent": "document",
      "finding": "Q4 budget approved on Dec 1",
      "confidence": 95,
      "nistTag": "GOVERN",
      "nistControlId": "GOVERN 1.1"
    }
  ],
  "hallucinations": [],
  "overallFaithfulness": 89
}
```

### Audit Trail Retention

| Artifact | Storage | Retention | Retrieval |
| :--- | :--- | :--- | :--- |
| **Job metadata + results** | Supabase PostgreSQL | Indefinite (user account lifetime) | SQL query, RLS-protected |
| **Governance trace** | Supabase JSON column | Indefinite | Dashboard + PDF export |
| **LangSmith traces** | LangSmith cloud | 1 year | LangSmith web UI (operator access only) |
| **Sentry errors** | Sentry cloud | 90 days | Sentry dashboard (ops team) |
| **CloudWatch logs** | AWS CloudWatch | 30 days default (configurable) | CloudWatch Insights queries |

### Compliance Use Cases

**Scenario 1: User GDPR Data Deletion Request**
1. User submits deletion request via dashboard (future: GDPR request form)
2. App deletes all rows in `jobs` table where `user_id = X`
3. RLS ensures only that user's data is deleted
4. S3 job files are marked for deletion (30-day retention window)
5. Proof: Supabase audit log shows deletion timestamp

**Scenario 2: AI Act Compliance Audit**
1. Regulator requests: "Show me why you chose GPT-4o for vision"
2. Response: Model card above + cite [README.md Model-to-Task Mapping](../README.md#-model-to-task-mapping)
3. Regulator requests: "Show me the governance trace for Job X"
4. Response: Provide governance trace JSON from job detail (includes NIST tags, confidence scores)
5. Regulator requests: "How do you catch hallucinations?"
6. Response: Show Auditor node implementation + example hallucination detection from job history

**Scenario 3: Data Breach Investigation**
1. CloudWatch alarm fires: spend > $15/month
2. Ops team queries CloudWatch Insights: which Lambda invocation caused spike?
3. Investigate LangSmith trace for that job: which model call failed or looped?
4. Check Sentry for concurrent errors; correlate with job ID
5. If PII exfiltration suspected: confirm PII was redacted before vectorization (code review + test evidence)

---

## Risk Assessment Framework

### Risk Categories & Mitigations

#### Hallucination Risk

| Risk | Level | Mitigation | Evidence |
| :--- | :--- | :--- | :--- |
| Synthesis makes ungrounded claims | Medium | LLM-as-Judge Auditor scores faithfulness + detects hallucinations | auditorNode.ts; test coverage in red-team.test.ts |
| Auditor itself hallucinating about hallucinations | Medium | Citation accuracy evaluator checks % of high-confidence findings | langsmith-evaluators.ts |
| Golden-set tests miss real-world retrieval failures | Low | Vitest golden-set covers chunk quality + deduplication + signal preservation | retrieval-eval.test.ts (14 tests) |

#### Data Leakage Risk

| Risk | Level | Mitigation | Evidence |
| :--- | :--- | :--- | :--- |
| PII exposed to LLMs | Medium | 5-pattern redaction before vectorization + test coverage | documentNode.ts; red-team.test.ts (15+ tests) |
| Cross-user data contamination | Low | Supabase RLS + session-namespaced vector keys | supabase-client.ts; documentNode.ts |
| Subprocessor data handling | Medium | Users sign DPA with Anthropic/OpenAI; Spectra responsible for lawful basis | README: subprocessors table |

#### Injection Attack Risk

| Risk | Level | Mitigation | Evidence |
| :--- | :--- | :--- | :--- |
| Prompt injection buried in user uploads | Medium | 14-pattern regex scan at ingestion + synthesis re-check | routerNode.ts; red-team.test.ts (14 tests) |
| False positive blocking legitimate content | Low | Regex refined over time; false positive monitoring in Sentry | Iterative regex tuning; Sentry error tracking |

#### Model Capability Risk

| Risk | Level | Mitigation | Evidence |
| :--- | :--- | :--- | :--- |
| Single-model bottleneck | Low | Multi-modal agents eliminate single point of failure; conflicts detected | Agent graph design; synthesis conflict tags |
| Model API downtime | Medium | No fallback; app blocks if any subprocessor unavailable | (Future: implement fallback models) |
| Model performance degradation over time | Low | LangSmith dashboards track faithfulness/citation accuracy trends | langsmith-evaluators.ts logs metrics |

#### Regulatory Compliance Risk

| Risk | Level | Mitigation | Evidence |
| :--- | :--- | :--- | :--- |
| GDPR breach due to data retention | Low | RLS + optional auto-cleanup after 90 days | Supabase RLS; CDK TTL policies (future) |
| AI Act non-transparency | Low | UI labels agents; governance trace shows reasoning | README agent graph; governance trace in PDF export |
| Undocumented model decisions | Low | Model cards document rationale, limitations, bias mitigation | This document (Model Governance section) |

---

## Control Evidence & Implementation Map

For compliance audits, this table maps each NIST function/control to its framework documentation, implementation mechanism, test evidence, and source code:

### NIST GOVERN Function

| Control | Framework | Implementation | Evidence | Source Code |
| :--- | :--- | :--- | :--- | :--- |
| **GOVERN 1.1** — Policies & accountability | [COMPLIANCE.md — Model Governance](#model-governance--model-cards) | Model cards document capability per task | Model card specs in table | [README.md — Model-to-Task Mapping](../README.md#-model-to-task-mapping) |
| **GOVERN 1.2** — Roles & responsibilities | [COMPLIANCE.md — Compliance Mechanisms](#spectra-compliance-mechanisms) | JWT/RBAC middleware enforces role-based access | RLS policy test coverage | [spectra-app/middleware.ts](../apps/spectra-app/middleware.ts) |

### NIST MAP Function

| Control | Framework | Implementation | Evidence | Source Code |
| :--- | :--- | :--- | :--- | :--- |
| **MAP 1.1** — Context & purpose documented | [COMPLIANCE.md — Model Governance](#model-governance--model-cards) | Model cards + README architecture diagrams | Model card contents | [COMPLIANCE.md — Model Cards](#model-cards) |
| **MAP 2.1** — Domain expertise informs development | [README.md — Core Architecture](../README.md#-core-architecture) | Agent graph design matches modality tasks | Multi-agent specialization | [spectra-api/src/graph/graph.ts](../apps/spectra-api/src/graph/graph.ts) |
| **MAP 3.5** — Risk identification practices applied | [COMPLIANCE.md — Risk Assessment Framework](#risk-assessment-framework) | Red team adversarial test matrix | 48 tests across injection, PII, synthesis | [SECURITY_ADVISORY.md](./SECURITY_ADVISORY.md) |

### NIST MEASURE Function

| Control | Framework | Implementation | Evidence | Source Code |
| :--- | :--- | :--- | :--- | :--- |
| **MEASURE 1.1** — Measurement approaches established | [EVALUATION_AND_CONTROLS.md — Evals Framework](./EVALUATION_AND_CONTROLS.md#evaluation-framework) | 3-layer eval: LLM-as-Judge + programmatic + golden-set | Faithfulness & citation accuracy scores logged to LangSmith | [spectra-api/src/lib/langsmith-evaluators.ts](../apps/spectra-api/src/lib/langsmith-evaluators.ts) |
| **MEASURE 2.1** — Grounding & factual accuracy assessed | [EVALUATION_AND_CONTROLS.md — Layer 1: Auditor](./EVALUATION_AND_CONTROLS.md#layer-1-llm-as-judge-auditor-in-graph-runtime) | LLM-as-Judge Auditor scores per-modality confidence 0–100 | Governance trace per job; confidence bars on dashboard | [spectra-api/src/graph/nodes/auditorNode.ts](../apps/spectra-api/src/graph/nodes/auditorNode.ts) |
| **MEASURE 2.5** — Hallucination & confabulation tracked | [EVALUATION_AND_CONTROLS.md — Hallucination Detection](./EVALUATION_AND_CONTROLS.md#hallucination-detection-list) | Auditor explicitly lists ungrounded claims | Hallucination field in governance trace; red team tests | [spectra-api/src/graph/nodes/auditorNode.ts](../apps/spectra-api/src/graph/nodes/auditorNode.ts) + [red-team.test.ts](../apps/spectra-api/src/__tests__/red-team.test.ts) |

### NIST MANAGE Function

| Control | Framework | Implementation | Evidence | Source Code |
| :--- | :--- | :--- | :--- | :--- |
| **MANAGE 1.1** — Risk treatment decisions documented | [COMPLIANCE.md — Data Governance](#data-governance) | Job metadata + governance trace persisted in Supabase with RLS | Audit trail queryable per user; timestamps immutable | [spectra-api/src/lib/supabase-client.ts](../apps/spectra-api/src/lib/supabase-client.ts) |
| **MANAGE 2.2** — Residual risks & uncertainties tracked | [COMPLIANCE.md — Risk Assessment Framework](#risk-assessment-framework) | Confidence scores indicate uncertainty; governance trace confidence field | Per-modality confidence (0–100) visible on dashboard; residual risks documented | [spectra-api/src/graph/nodes/auditorNode.ts](../apps/spectra-api/src/graph/nodes/auditorNode.ts) |

### Cross-Cutting Controls (Guardrails & Data Protection)

| Control Area | Framework | Implementation | Evidence | Source Code |
| :--- | :--- | :--- | :--- | :--- |
| **Prompt Injection** | [EVALUATION_AND_CONTROLS.md — Injection Detection](./EVALUATION_AND_CONTROLS.md#prompt-injection-detection) | 14-pattern regex scan at ingestion + synthesis re-check | Red team: 14 injection variant tests | [spectra-api/src/graph/nodes/routerNode.ts](../apps/spectra-api/src/graph/nodes/routerNode.ts) + [red-team.test.ts](../apps/spectra-api/src/__tests__/red-team.test.ts) |
| **PII Redaction** | [EVALUATION_AND_CONTROLS.md — PII Redaction](./EVALUATION_AND_CONTROLS.md#pii-redaction) | 5-pattern masking (email, phone, SSN, card, NINO) before vectorization | Red team: 15+ tests for patterns + false positives | [spectra-api/src/graph/nodes/documentNode.ts](../apps/spectra-api/src/graph/nodes/documentNode.ts) |
| **Synthesis Validation** | [EVALUATION_AND_CONTROLS.md — Synthesis Validation](./EVALUATION_AND_CONTROLS.md#synthesis-output-validation) | Length floor (≥200 chars) + injection re-check + citation tags required | Red team: 5+ synthesis validation tests | [spectra-api/src/graph/nodes/synthesisNode.ts](../apps/spectra-api/src/graph/nodes/synthesisNode.ts) |
| **Rate Limiting** | [EVALUATION_AND_CONTROLS.md — Rate Limiting](./EVALUATION_AND_CONTROLS.md#rate-limiting--billing-ceiling) | Upstash Redis sliding window (3 runs/day/IP) + $15/month CloudWatch alarm | Billing alarm configured in CDK; unit tests validate window config (3/day upload, 10/hr auth) and IP extraction across all three rate-limited routes | [spectra-api/lib/stacks/MonitoringStack.ts](../apps/spectra-api/lib/stacks/MonitoringStack.ts) |
| **RLS & Access Control** | [COMPLIANCE.md — RLS & Access Control](#3-row-level-security-rls--access-control) | Supabase RLS policies on jobs table | RLS policy enforced at database level; no cross-user leakage | [spectra-api/migrations/001_jobs.sql](../apps/spectra-api/migrations/001_jobs.sql) |
| **Audit Trail** | [EVALUATION_AND_CONTROLS.md — Audit Trail](./EVALUATION_AND_CONTROLS.md#audit-trail--traceability) | Supabase (metadata) + Sentry (errors) + LangSmith (traces) | Job history queryable; LangSmith traces exportable; Sentry incidents tracked | [spectra-api/src/handlers/jobProcessor.ts](../apps/spectra-api/src/handlers/jobProcessor.ts) |

---

## Summary: Compliance Posture

| Regulation | Applicability | Spectra Status | Gaps |
| :--- | :--- | :--- | :--- |
| **GDPR** | EU users | Compliant for lawful basis, RLS, PII redaction, audit trail | DPIA not yet conducted; GDPR request form future work |
| **EU AI Act** | EU users | Transparent + documented (model cards) + audit trail | Risk assessment not formally published |
| **HIPAA** | Healthcare data (if uploaded) | Not certified; users advised not to upload PHI | (Future: HIPAA mode with BAAs) |
| **CCPA/CPRA** | California users | Compliant for data deletion + transparency | Automated CCPA request form future work |
| **SOC 2** | Subprocessors | Compliant (Anthropic, OpenAI, AWS all SOC 2 Type II) | Spectra itself not SOC 2 audited (portfolio-scale project) |

---

## Recommended Reading

- **Model Governance:** See [Model Governance & Model Cards](#model-governance--model-cards) above for detailed capabilities, limitations, and bias mitigation per model.
- **Data Flow & Audit Trail:** See [EVALUATION_AND_CONTROLS.md — Data Flow & Audit Trail](./EVALUATION_AND_CONTROLS.md#data-flow--audit-trail) for logging mechanisms and LangSmith tracing.
- **Injection Detection & PII Redaction:** See [SECURITY_ADVISORY.md](./SECURITY_ADVISORY.md) and [EVALUATION_AND_CONTROLS.md](./EVALUATION_AND_CONTROLS.md) for adversarial test evidence.
- **Governance Trace with NIST Tags:** Every job produces a governance trace with NIST AI RMF function tags (GOVERN / MAP / MEASURE / MANAGE). See [EVALUATION_AND_CONTROLS.md — Governance Trace](./EVALUATION_AND_CONTROLS.md#governance-trace-per-finding) for structure and interpretation.

---

## Internal Documentation

**Evaluation & Controls**, **Red Team Methodology**, and **Security Advisory** papers are maintained locally and intentionally not published to prevent detailed red-teaming methodology, injection patterns, and PII detection rules from being publicly available. These documents are for internal architectural knowledge and compliance investigation — sharing specific attack vectors and defense patterns creates unnecessary risk surface.

**Public Documentation:** COMPLIANCE.md, ARCHITECTURE_FLOWS.md, TECHNICAL_ADVISORY.md, HARDENING_ROADMAP.md, OPERATIONS_RUNBOOK.md, and README.md are published. These cover governance frameworks, regulatory alignment, architectural rationale, and operational guidance without exposing tactical security details.

---

**Last Updated:** 2026-05-06  
**Owner:** Architecture & Compliance
