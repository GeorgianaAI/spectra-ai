# Spectra AI — Architecture

## Overview

Spectra AI is a multimodal intelligence platform. A user uploads a PDF, an image, and an audio file. These are routed through a six-node LangGraph agent graph — each modality processed by a specialist model — and merged into a single cited synthesis report, scored for faithfulness by an LLM-as-Judge Auditor. The UI streams the report live and shows the agent graph state in real time.

The system is split across two independently deployable units:

- **spectra-app** — Next.js 15 frontend, deployed on Vercel
- **spectra-api** — AWS CDK + Lambda backend, deployed on AWS

They communicate via S3 presigned URLs (upload path) and REST API routes (job status path). Job lifecycle is coordinated by Inngest; agent execution is coordinated by LangGraph inside the Lambda.

---

## System Diagram

See [`docs/architecture.mermaid`](./docs/architecture.mermaid).

---

## Data Flow

### Upload Path

```
User (browser)
  → POST /api/upload (Next.js, JWT validated, rate limited)
  → S3 presigned PUT (PDF + image + audio → spectra-uploads bucket)
  → S3 ObjectCreated event → ingestHandler Lambda
  → ingestHandler: validates file type/size, fires Inngest event
  → Inngest: creates job record in Supabase (status: pending)
  → Inngest: invokes jobProcessor Lambda via HTTP
```

### Processing Path (inside Lambda)

```
jobProcessor Lambda
  → LangGraph StateGraph
      → routerNode (Nova Micro / Bedrock)
            classifies active modalities from s3Keys
      → [documentNode ‖ visionNode ‖ audioNode]  (parallel)
            documentNode: S3 download → PII redact → chunk → embed → Upstash Vector → Claude Sonnet findings
            visionNode:   S3 download → GPT-4o vision → structured annotations
            audioNode:    S3 download → Whisper transcription → Claude Sonnet extraction
      → synthesisNode (GPT-4o)
            merges findings, flags conflicts, generates cited report [D1] [V2] [A1]
      → auditorNode (Claude Sonnet)
            LLM-as-Judge: scores faithfulness per modality, produces governance trace
  → write confidenceScores + governanceTrace + report → Supabase jobs table
  → Inngest marks job completed
```

### Polling Path

```
Frontend polls GET /api/job/[id] (JWT, user-ownership check)
  ← Supabase jobs row (status, confidence_scores, governance_trace)
When status === 'completed':
  → SynthesisPanel streams report via Vercel AI SDK
  → AgentGraph updates node statuses
  → GovernanceTrace renders decision log
  → ConfidenceBar renders per-modality scores
```

---

## Component Responsibilities

### spectra-app

| Component         | Responsibility                                                              |
| :---------------- | :-------------------------------------------------------------------------- |
| `UploadZone`      | Three modality drop targets, calls `onUpload(files)` callback               |
| `AgentGraph`      | Visual node graph, driven by `agentStatuses` prop                           |
| `SynthesisPanel`  | Streaming markdown report, parses citation badges `[D1]` `[V2]` `[A1]`     |
| `ConfidenceBar`   | Three labelled progress bars, per-modality colours                          |
| `GovernanceTrace` | Collapsible decision log table, NIST AI RMF tags per row                    |
| `middleware.ts`   | JWT guard on all `/dashboard` routes                                        |
| `/api/upload`     | Validates JWT + rate limit, presigned S3 PUT, creates Supabase job record   |
| `/api/job/[id]`   | Returns job status + result from Supabase (JWT + ownership check)           |
| `/api/inngest`    | Inngest serve handler (job lifecycle events)                                |
| `/api/auth/token` | Issues JWT for email/password (Supabase Auth)                               |

### spectra-api

| Module              | Responsibility                                                                           |
| :------------------ | :--------------------------------------------------------------------------------------- |
| `StorageStack`      | S3 bucket (`spectra-uploads`), versioning, lifecycle, CORS, ObjectCreated trigger        |
| `ComputeStack`      | `ingestHandler` Lambda (S3 trigger), `jobProcessor` Lambda (Inngest HTTP), CloudWatch   |
| `ObservabilityStack`| CloudWatch billing alarm ($20 ceiling), dashboard (invocations, errors, duration)       |
| `ingestHandler`     | Validates upload, fires Inngest event                                                    |
| `jobProcessor`      | Runs LangGraph graph, writes results to Supabase                                         |
| `routerNode`        | Nova Micro classification → sets `activeModalities`                                     |
| `documentNode`      | PDF → PII redact → chunk → embed → vector store → Claude Sonnet findings                |
| `visionNode`        | Image → GPT-4o vision → annotations                                                     |
| `audioNode`         | Audio → Whisper → Claude Sonnet extraction                                              |
| `synthesisNode`     | Merge + conflict detection + cited report (GPT-4o)                                     |
| `auditorNode`       | Faithfulness scoring + governance trace (Claude Sonnet)                                 |

---

## Model-to-Task Mapping

| Agent       | Model                  | Rationale                                                     |
| :---------- | :--------------------- | :------------------------------------------------------------ |
| Router      | Nova Micro (Bedrock)   | Classification only — cost-optimized, no reasoning depth needed |
| Document    | Claude Sonnet          | RAG + grounded citation extraction — Anthropic strength       |
| Vision      | GPT-4o                 | Best native image understanding available                     |
| Audio       | Whisper → Claude Sonnet| Transcription (Whisper) + structured extraction (Sonnet)      |
| Synthesis   | GPT-4o                 | Multi-source merging and conflict resolution                   |
| Auditor     | Claude Sonnet          | Faithfulness and hallucination detection — Anthropic strength  |

---

## Infrastructure Decisions

### Why LangGraph instead of Step Functions

LangGraph is already a state machine with nodes, edges, parallel branches, checkpointing, and retry logic. Adding Step Functions would be orchestrating an orchestrator — the outer layer adds nothing because LangGraph handles everything internally. Step Functions would only make sense if we replaced LangGraph entirely with one Lambda per agent node, which would lose LangSmith tracing, parallel execution primitives, and checkpointing.

### Why Inngest instead of SQS

SQS is a raw queue — it has no job state, no retry UI, no event history. Inngest gives job lifecycle management (pending → processing → completed/failed), automatic retries with exponential backoff, and a dev dashboard. For the Spectra use case — a user-facing job with a status they can poll — Inngest is the correct abstraction.

### Why Upstash Vector instead of OpenSearch

OpenSearch has a minimum cluster cost that is incompatible with a portfolio-scale billing ceiling. Upstash Vector is serverless, pay-per-request, and supports session-namespaced retrieval. At production scale, OpenSearch would replace it.

### Why Bedrock only for Nova Micro

Bedrock adds IAM complexity and cold-start overhead. It is used only for the Router Agent because Nova Micro is uniquely cost-optimized for classification tasks and is not available outside Bedrock. All other model calls use the Anthropic SDK and OpenAI SDK directly, which are simpler and faster to iterate on.

---

## Security Boundaries

- JWT validated on every API route before any processing
- Rate limiting (Upstash, 3 req/day/IP) applied before file validation in `/api/upload`
- File size caps enforced before S3 upload (2 MB PDF, 1 MB image)
- PII redacted in `documentNode` before vectorization
- Supabase Row Level Security — users can only read/write their own jobs
- Session-isolated vector namespaces: `{jobId}/{userId}/` prefix
- `SUPABASE_SERVICE_KEY` is server-only, never exposed to the client

---

## Known Limitations (intentional at portfolio scale)

- Lambda concurrency set to 1 during demo period to prevent cost accumulation
- Upstash Vector replaces OpenSearch — not production-scale for large document sets
- Inngest replaces Step Functions — appropriate for current job volume
- No multi-region redundancy
- No CDN for uploaded files (S3 direct presigned URLs)
