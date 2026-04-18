# 🌐 Spectra AI — Architecture Flows

This document captures the core runtime flows that define Spectra's current behavior.
Updated as each Phase ships — if a code change alters runtime behavior without updating this doc, treat that as an incomplete PR.

Use this file as the engineering source of truth for flow-level behavior.

---

## How to Read These Diagrams

- **UI** = dashboard and auth pages (Next.js 16, Vercel)
- **Middleware** = `middleware.ts` — JWT guard on all `/dashboard` and `/api` routes
- **/api/upload** = file validation, rate limiting, S3 presigned PUT, Inngest trigger
- **Inngest** = job lifecycle (pending → processing → completed/failed), retries
- **Lambda** = `ingestHandler` (S3 trigger) + `jobProcessor` (Inngest HTTP invocation)
- **LangGraph** = agent orchestration inside `jobProcessor`
- **Supabase** = job record storage, Auth, RLS
- **Upstash Redis** = rate limiting (frontend) + LangGraph checkpointing (Lambda)

Status code conventions used across flows:

- `400` malformed request payload
- `401` unauthenticated (missing or invalid JWT)
- `403` authenticated but not the job owner
- `429` rate limit exceeded (3 req/day/IP)
- `501` not yet implemented (scaffold phase)
- `503` critical runtime dependency unavailable (production strict mode)

---

## 1) Main System Architecture

### Diagram

```mermaid
flowchart TD
    A["User — Next.js 16 (Vercel)\nPDF · Image · Audio upload\nJWT/RBAC · Sentry · Rate limiting"]

    subgraph FE ["spectra-app — Vercel"]
        FE1["POST /api/upload\nJWT validate · rate limit · presigned S3 PUT"]
        FE2["Inngest serve handler\n/api/inngest"]
        FE3["GET /api/job/[id]\nPoll status · ownership check"]
        FE4["Dashboard UI\nUploadZone · AgentGraph · SynthesisPanel\nConfidenceBar · GovernanceTrace"]
    end

    subgraph INNGEST ["Inngest — Job Lifecycle"]
        INN1["spectra/job.process\nretries · exponential backoff\nSupabase job record management"]
    end

    subgraph AWS ["AWS — CDK · CloudWatch"]
        S3["S3: spectra-uploads\nversioning · lifecycle · CORS"]
        INGEST["ingestHandler Lambda\nValidate file type/size\nFire Inngest event"]
        JOBPROC["jobProcessor Lambda\n1024MB · 300s timeout\nRuns LangGraph graph"]
        OBS["ObservabilityStack\nBilling alarm $20 · CloudWatch dashboard"]
    end

    subgraph GRAPH ["LangGraph Agent Graph — LangSmith tracing"]
        ROUTER["routerNode\nNova Micro (Bedrock)\nClassify active modalities"]
        DOC["documentNode\nClaude Sonnet\nPDF · PII redact · RAG · citations"]
        VIS["visionNode\nGPT-4o\nImage analysis · annotations"]
        AUD["audioNode\nWhisper → Claude Sonnet\nTranscription · extraction"]
        SYN["synthesisNode\nGPT-4o\nMerge · conflict resolve · cited report"]
        AUDIT["auditorNode\nClaude Sonnet (LLM-as-Judge)\nFaithfulness · governance trace"]
    end

    subgraph DATA ["Data Layer"]
        SUP["Supabase PostgreSQL\njobs · auth · RLS"]
        VEC["Upstash Vector\nSession-namespaced embeddings"]
        REDIS["Upstash Redis\nRate limiting · LangGraph checkpointing"]
        RESEND["Resend\nJob completion email"]
    end

    A --> FE1
    FE1 --> S3
    S3 -->|ObjectCreated| INGEST
    INGEST --> INN1
    INN1 --> JOBPROC
    FE2 <-->|events| INN1
    FE3 --> SUP

    JOBPROC --> ROUTER
    ROUTER --> DOC & VIS & AUD
    DOC --> VEC
    DOC --> SYN
    VIS --> SYN
    AUD --> SYN
    SYN --> AUDIT
    AUDIT --> SUP

    INN1 --> SUP
    AUDIT --> REDIS
    OBS -.->|monitors| JOBPROC
    SUP --> FE3
    FE3 --> FE4
    SUP --> RESEND
```

---

## 2) Upload → Agent Pipeline Flow

### Why this exists

The upload path spans four systems (Next.js → S3 → Lambda → LangGraph → Supabase) and two async boundaries (S3 trigger, Inngest invocation). This diagram makes the hand-off points and failure modes explicit.

### What this flow guarantees

- Rate limit applied before any file processing — no backend cost on abuse.
- JWT ownership enforced at every API boundary.
- S3 receives files only after all validation passes.
- Job record created in Supabase before Lambda runs — frontend can poll immediately.
- Inngest owns retries; Lambda does not retry internally.
- Results written to Supabase atomically; frontend polls until `status === 'completed'`.

### Diagram

```mermaid
sequenceDiagram
autonumber
participant UI as Dashboard UI
participant MW as middleware.ts
participant API as /api/upload
participant S3 as S3: spectra-uploads
participant INGEST as ingestHandler Lambda
participant INN as Inngest
participant PROC as jobProcessor Lambda
participant LG as LangGraph
participant SUP as Supabase

UI->>MW: POST /api/upload (Bearer token + multipart files)
MW->>API: Forward + validated JWT claims
API->>API: Rate limit check — Upstash Redis (3/day/IP)
API-->>UI: 429 { error, code: RATE_LIMITED } if exceeded
API->>API: Validate file types + sizes (Zod)
API-->>UI: 400 { error, code: INVALID_FILES } if invalid
API->>S3: PutObjectCommand — upload each file server-side (PDF · image · audio)
API->>SUP: INSERT job { status: pending, modalities_used, user_id }
API->>INN: Fire event spectra/job.process { jobId, userId, s3Keys }
API-->>UI: 200 { jobId }

S3-->>INGEST: ObjectCreated event
INGEST->>INGEST: Validate file type + size
INGEST->>INN: Fire Inngest event (redundant safety trigger)

INN->>PROC: HTTP invoke jobProcessor { jobId, userId, s3Keys }
PROC->>SUP: UPDATE job { status: processing }
PROC->>LG: Execute StateGraph
LG->>LG: routerNode → [documentNode ‖ visionNode ‖ audioNode] → synthesisNode → auditorNode
LG-->>PROC: { confidenceScores, governanceTrace, report }
PROC->>SUP: UPDATE job { status: completed, confidence_scores, governance_trace }
PROC-->>INN: 200 OK

UI->>API: GET /api/job/[id] (poll every 2s)
API->>SUP: SELECT job WHERE id = jobId AND user_id = userId
SUP-->>API: job row
API-->>UI: { status, confidence_scores, governance_trace }
UI->>UI: Render SynthesisPanel + AgentGraph + GovernanceTrace when completed
```

---

## 3) JWT Auth + Middleware Guard Flow

### Why this exists

Spectra separates unauthenticated public routes (landing, login) from protected dashboard and API routes. The middleware layer enforces this boundary before any page or handler executes.

### What this flow guarantees

- Unauthenticated users are redirected to `/auth/login` (pages) or receive `401` (API routes).
- Valid tokens pass actor identity through to downstream handlers for ownership checks.
- Public routes (`/`, `/auth/login`, `/api/auth/token`, `/api/inngest`, `/api/health`) are never blocked.

### Diagram

```mermaid
flowchart TD
A[Request arrives] --> B{Public route?}
B -- yes --> C[Pass through — no auth check]

B -- no --> D[middleware.ts: extract Bearer token or cookie]
D --> E{Token present?}
E -- no --> F{Page or API route?}
F -- page --> G[Redirect to /auth/login]
F -- api --> H[401 Unauthorized]

E -- yes --> I[Verify JWT with JWT_SECRET]
I --> J{Valid + not expired?}
J -- no --> F
J -- yes --> K[Attach userId to request headers]
K --> L[Forward to page or API handler]

L --> M{API handler: ownership check}
M -- job.user_id ≠ userId --> N[403 Forbidden]
M -- match --> O[Return job data]
```

---

## 4) Rate Limiting Flow

### Why this exists

`/api/upload` triggers the full agent pipeline — Bedrock, OpenAI, Whisper, Lambda compute. Uncapped, a single abusive IP could drain the monthly cost ceiling in minutes. Rate limiting is the first check applied, before JWT validation or any file processing.

### What this flow guarantees

- 3 requests per day per IP, sliding window (Upstash Redis).
- Demo account subject to the same limit — no exceptions.
- Limit hit returns `429` immediately, no backend cost incurred.
- Real cost guard is the CloudWatch $20 billing alarm — rate limit is the first line of defence.

### Diagram

```mermaid
flowchart LR
A["POST /api/upload"] --> B["Read client IP\n(x-forwarded-for or socket)"]
B --> C["Upstash Redis\nsliding window\n3 req / day / IP"]
C --> D{Limit exceeded?}
D -- yes --> E["429\n{ error: Rate limit exceeded\n  code: RATE_LIMITED }"]
D -- no --> F["Continue to JWT validation\n→ file validation\n→ S3 upload\n→ job creation"]
```

---

## 5) Runtime Strictness Policy (Health + Dependencies)

### Why this exists

Spectra must remain developer-friendly in non-production (missing env vars are tolerated) while being strict and predictable in production (missing or errored deps fail closed with `503`).

### What this flow guarantees

- Non-prod/CI allows degraded deps — supports local dev without all services wired.
- Production fails closed when Supabase or Redis are unavailable — no silent half-broken state.
- Health endpoint used by `scripts/verify-ready.mjs` and UptimeRobot.

### Diagram

```mermaid
flowchart LR
A["GET /api/health"] --> B{Environment?}

B -- Non-production --> C["Probe Supabase + Redis\n(4s timeout each)"]
C --> D{Any hard errors?}
D -- no --> E["200 ok\n(missing is tolerated)"]
D -- yes --> F["200 degraded\nwarn log"]

B -- Production --> G["Probe Supabase + Redis\n(4s timeout each)"]
G --> H{Missing or error?}
H -- yes --> I["503 degraded\nerror log\n(fail closed)"]
H -- no --> J["200 ok"]
```

---

## Update Rules

Update this document whenever any of the following changes:

- Upload pipeline hand-off points or validation order
- Rate limiting algorithm, threshold, or scope
- JWT verification logic or protected route set
- Dependency strictness policy or health endpoint semantics
- Agent graph execution order or node responsibilities

---

## Suggested Companion Docs

- `ARCHITECTURE.md` — component responsibilities, model-to-task mapping, infrastructure decisions
- `CLAUDE.md` — development governance, build phases, TypeScript rules
- `TECHNICAL_ADVISORY.md` — architecture tradeoffs and cost decisions *(created after Phase 5)*
- `HARDENING_ROADMAP.md` — post-launch hardening checklist *(created after Phase 5)*
