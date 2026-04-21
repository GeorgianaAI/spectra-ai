# 🌐 Spectra AI: Multimodal Intelligence Agent

**[🚀 View Live Demo](#)** | **[📂 View Codebase](https://github.com/GeorgiDS9/spectra-ai)**

**Multimodal AI | Multi-Agent Graph | LangGraph Orchestration | LLM-as-Judge Auditor | NIST AI RMF Governance**

**Spectra AI** is a multimodal intelligence agent that routes **documents, images, and audio** through a specialist multi-agent graph — processing all three modalities in parallel, merging findings into a single grounded cited report, and scoring the synthesis for faithfulness with an LLM-as-Judge Auditor.

The premise is that real-world intelligence problems are never single-modality. A security analyst gets a PDF report, a screenshot of an anomaly, and a voice memo from a colleague — and has to reason across all three simultaneously. Spectra ingests all three, routes each to a specialized agent, and a synthesis layer produces a single cited output with the reasoning process visible live in the UI.

Built on **LangGraph**, **Claude Sonnet**, **GPT-4o**, and **Whisper**, with **AWS infrastructure** (S3, Lambda, Bedrock), **Inngest** for job orchestration, and a **live agent status dashboard** streaming results in real time. Deployed as two independently deployable units — **spectra-app** (Next.js 16 on Vercel) and **spectra-api** (AWS CDK + Lambda).

---

## 🧐 What Makes Spectra Genuinely Multi-Agent

Spectra is not multi-agent by label — the architecture requires it by design. Each modality has meaningfully different processing logic, tool use, and failure modes. A single agent handling all three would be a bloated prompt with no separation of concerns.

1. **Router Agent (Nova Micro / Bedrock):** Receives the raw inputs, classifies which modalities are present, and delegates to the right specialist nodes via LangGraph parallel branching. Cost-optimized — classification only.

2. **Document Agent (Claude Sonnet):** PDF parsing, chunking, PII redaction before vectorization, RAG retrieval from Upstash Vector under a session-namespaced key, citation extraction with page references.

3. **Vision Agent (GPT-4o):** Native image understanding, entity extraction, structured annotations, bounding descriptions. GPT-4o is materially stronger here — no compromise.

4. **Audio Agent (Whisper → Claude Sonnet):** Whisper transcription followed by Claude Sonnet structured extraction. Not an LLM reasoning task — transcription first, then structured output.

5. **Synthesis Agent (GPT-4o):** Receives all specialist outputs, merges findings, detects and flags contradictions between modalities (`[CONFLICT: D1 vs V2]`), generates a unified cited report with `[D1]`, `[V2]`, `[A1]` source tags.

6. **Auditor (Claude Sonnet — LLM-as-Judge):** Scores the synthesis for faithfulness, hallucination, and grounding per modality. Produces a governance trace entry per finding with a NIST AI RMF tag. Always runs last.

Router and Synthesis are the orchestration layer. The three specialists are the execution layer. That is a clean two-tier hierarchy.

---

## 🖼️ Product Snapshot

> _(Screenshots added after Phase 5 deployment)_

---

## 🌐 What Spectra Does

At runtime, Spectra:

- **Accepts file uploads** from the user — PDF, image, audio (up to 2 MB / 1 MB, or preset sample files).
- **Routes each file** to its specialist agent via LangGraph parallel branching.
- **Streams the synthesis report** progressively to the UI via Vercel AI SDK.
- **Shows the agent graph live** — which node is processing, which is complete, which is idle.
- **Scores the output** per modality (Document / Vision / Audio confidence %) via the LLM-as-Judge Auditor.
- **Produces a governance trace** — per-finding decision log with NIST AI RMF tags (GOVERN / MAP / MEASURE / MANAGE).
- **Flags conflicts** between modalities in the report: `[CONFLICT: D1 vs V2]`.
- **Isolates retrieval per session** — Upstash Vector namespaced by `{jobId}/{userId}/`.
- **Redacts PII** before vectorization (Document Agent).

---

## 🧾 What Spectra Produces

### 1) Synthesis Report

Streaming markdown with inline citation badges — `[D1]` (teal), `[V2]` (sky blue), `[A1]` (coral). Each claim tagged to its modality source. Conflicts flagged inline.

### 2) Per-Modality Confidence Scores

Three percentage scores from the LLM-as-Judge Auditor: Document, Vision, Audio — rendered as labeled horizontal bars in their modality colors.

### 3) Governance Trace

A decision log table — per-finding entries with timestamp, agent, finding summary, confidence score, and NIST AI RMF tag. Collapsed by default, expandable. Exportable as structured JSON.

### 4) Job History

Full history of past runs — status, modalities used, timestamps, links to job detail. Supports replay and review.

### 5) NIST AI RMF Compliance Ledger

Full governance ledger across all jobs — traceable control evidence mapped to AI risk management. Portfolio differentiator.

---

## 🎯 How to Use Spectra

1. Upload one or more files — PDF, image, audio. Or use the preset sample files (no upload needed).
2. Click **Run Analysis**.
3. Watch the agent graph update live as each specialist node processes its input.
4. Read the streaming synthesis report with inline citations and conflict flags.
5. Review the confidence scores and governance trace at the bottom.

### 🔐 Demo Access

```
Email:    demo@spectra.app
Password: spectra-demo
```

The demo account is a regular user. No special permissions. Rate limit: 3 runs/day/IP.

---

## 🏗️ Architecture

### Agent Graph

```
routerNode (Nova Micro / Bedrock)
    ↓
[documentNode (Claude Sonnet) ‖ visionNode (GPT-4o) ‖ audioNode (Whisper → Sonnet)]
    ↓  parallel, conditional on active modalities
synthesisNode (GPT-4o)
    ↓
auditorNode (Claude Sonnet — LLM-as-Judge)
    ↓
write to Supabase
```

### Infrastructure

```
spectra-app (Vercel)                     spectra-api (AWS)
──────────────────────                   ─────────────────────────────
Next.js 16 App Router                    CDK: StorageStack + ComputeStack
Vercel AI SDK (streaming)                S3: spectra-uploads (versioned)
JWT/RBAC middleware                      Lambda: ingestHandler (S3 trigger)
Inngest serve handler                    Lambda: jobProcessor (Inngest HTTP)
Upstash rate limiting                    Bedrock: Nova Micro (Router only)
Supabase client (polling)                LangGraph (inside jobProcessor)
                                         Upstash Vector (session embeddings)
                                         Upstash Redis (checkpointing)
                                         LangSmith (end-to-end tracing)
                                         CloudWatch (billing alarm + dashboard)
```

For the full runtime flows, sequence diagrams, and infrastructure decisions see [ARCHITECTURE_FLOWS.md](./ARCHITECTURE_FLOWS.md).

---

## 🛠️ Tech Stack

| Area              | Technology                                                             |
| :---------------- | :--------------------------------------------------------------------- |
| Frontend          | Next.js 16 App Router · TypeScript · Tailwind CSS 4 · Vercel AI SDK    |
| Backend IaC       | AWS CDK (TypeScript)                                                   |
| Compute           | AWS Lambda (Node.js 20.x)                                              |
| AI routing        | AWS Bedrock — Nova Micro (`amazon.nova-micro-v1:0`)                    |
| Agent graph       | LangGraph (TypeScript) — StateGraph, parallel branching, checkpointing |
| Tracing           | LangSmith                                                              |
| Models            | Claude Sonnet · GPT-4o · Whisper · Nova Micro                          |
| Embeddings        | text-embedding-3-small                                                 |
| Vector store      | Upstash Vector (session-namespaced)                                    |
| Database          | Supabase PostgreSQL + Auth (RLS)                                       |
| Job orchestration | Inngest (event-driven, retries, state tracking)                        |
| Rate limiting     | Upstash Redis (3 req/day/IP sliding window)                            |
| Error tracking    | Sentry (client + server + Lambda)                                      |
| CI                | GitHub Actions (lint, typecheck, Vitest, Playwright)                   |

---

## 🔒 Model-to-Task Mapping

Spectra deliberately matches model capability to task rather than defaulting to a single provider:

| Agent     | Model                   | Rationale                                                               |
| :-------- | :---------------------- | :---------------------------------------------------------------------- |
| Router    | Nova Micro (Bedrock)    | Classification only — cheapest correct model, no reasoning depth needed |
| Document  | Claude Sonnet           | RAG + grounded citation extraction — Anthropic's core strength          |
| Vision    | GPT-4o                  | Best native image understanding available — non-negotiable              |
| Audio     | Whisper → Claude Sonnet | Transcription (Whisper) + structured extraction (Sonnet)                |
| Synthesis | GPT-4o                  | Multi-source merging and conflict resolution                            |
| Auditor   | Claude Sonnet           | Faithfulness + hallucination detection — Anthropic's core strength      |

---

## 🧭 Engineering Philosophy

Spectra demonstrates that multi-agent architecture is a requirement when modalities genuinely differ — not a label applied for effect. Each specialist has its own tool set, failure modes, and output schema. The two-tier hierarchy (Router + Synthesis as orchestrators, specialists as executors) reflects how the problem actually decomposes.

The infrastructure tradeoffs are deliberate: LangGraph over Step Functions (no point orchestrating an orchestrator), Inngest over SQS (job lifecycle management, not a raw queue), Upstash Vector over OpenSearch (portfolio-scale cost ceiling), Bedrock scoped to Nova Micro (cheapest correct model for classification, everything else via direct SDK).

## The $20/month CloudWatch billing alarm is the real cost guard — not the rate limit.

## ⚙️ Getting Started

### Prerequisites

- Node.js 20+
- AWS CLI configured (`aws configure`)
- AWS CDK CLI: `npm install -g aws-cdk`
- CDK bootstrapped: `cdk bootstrap aws://ACCOUNT/eu-west-1`
- Supabase project created
- Upstash Vector + Redis databases created
- Inngest account
- LangSmith account

### Backend (spectra-api)

```bash
cd apps/spectra-api
cp .env.example .env
# Fill in all values
npm install
npm run build
npm run cdk:diff
npm run cdk:deploy
```

Run Supabase migrations in order:

1. `migrations/001_jobs.sql`
2. `migrations/002_demo_seed.sql`

### Frontend (spectra-app)

```bash
cd apps/spectra-app
cp .env.example .env.local
# Fill in all values (point NEXT_PUBLIC_API_URL at your deployed Lambda or localhost)
npm install
npm run dev
```

---

## 🚦 Build Phases

| Phase | Area                                                                          | Status      |
| :---- | :---------------------------------------------------------------------------- | :---------- |
| 1     | Monorepo shell + CDK scaffold + Next.js scaffold                              | ✅ Complete |
| 2     | LangGraph agent graph + Inngest + API surface                                 | ✅ Complete |
| 3     | UploadZone + AgentGraph + SynthesisPanel + GovernanceTrace                    | ✅ Complete |
| 4     | Integration + hardening (JWT/RBAC, PII redaction, Sentry, Vitest, Playwright) | ✅ Complete |
| 5     | AWS deployment (cdk deploy, concurrency limit, UptimeRobot)                   | ✅ Complete |
