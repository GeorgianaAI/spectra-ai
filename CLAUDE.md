# SPECTRA AI | Architecture & Governance

## 1. Project Intent

Spectra AI is a multimodal intelligence agent that routes documents, images, and audio through a specialist multi-agent graph — Document, Vision, and Audio agents processing in parallel, a Synthesis agent merging findings with per-modality citations, and an LLM-as-Judge Auditor scoring faithfulness across all three.

Built on LangGraph, Claude Sonnet, GPT-4o, and Whisper, with AWS infrastructure (S3, Lambda, Bedrock), Inngest for job orchestration, and a live agent status dashboard streaming results in real time. The Router Agent runs on AWS Bedrock (Nova Micro) for cost-optimized classification, while quality-critical nodes use Claude Sonnet for grounded synthesis and GPT-4o for native image understanding — deliberately matching model capability to task rather than defaulting to a single provider.

Portfolio-scale project. AWS free tier priority. Hard billing ceiling at 15/month via CloudWatch alarm.

## 2. Technical Stack

**Frontend (spectra-app):** Next.js 16 App Router + TypeScript strict, Tailwind CSS 4, Vercel AI SDK (streaming), Zod, JWT/RBAC, Supabase JS SDK, Upstash Redis + Ratelimit, Inngest, Sentry.

**Backend (spectra-api):** AWS CDK (IaC), Lambda (ingestHandler, jobProcessor), S3, Bedrock (Nova Micro for Router only), LangGraph (agent orchestration), LangSmith (tracing), Supabase PostgreSQL, Upstash Vector (session-namespaced) + Redis (checkpointing), Inngest.

**Models (enforced mapping):**

- Router: Nova Micro (Bedrock)
- Document: Claude Sonnet (Anthropic SDK)
- Vision: GPT-4o (OpenAI)
- Audio: Whisper (OpenAI) → Claude Sonnet
- Synthesis: GPT-4o (OpenAI)
- Auditor: Claude Sonnet (Anthropic SDK)

**Full breakdown:** See [Tech Stack reference](MEMORY.md).

## 2.1 Version Governance & Stability Lock

**Strict Version Policy:** Locked to **Next.js 16.2.6** and the dependency versions installed during Phase 1 scaffold. Do not upgrade without an explicit decision from the Architect.

- Do not use React 19-specific APIs unless already present in the scaffold.
- If an "upgrade available" notice appears, ignore it.

## 3. Development Workflow Hygiene

### Branching & Commits

- **Repo:** `spectra/` root. `apps/spectra-app/` and `apps/spectra-api/` are independently deployable, each with `package.json`.
- **Feature Branches:** `feat/`, `fix/`, `refactor/` required for code changes. Only `.md` documentation may go directly to `main`.
- **No Merges:** Pushing is encouraged; merging restricted to Architect (User).
- **Branch Hygiene:** Before new branch: run `git branch --merged`, delete merged branches. Stop if unmerged branches exist — alert Architect.
- **Atomic Commits:** Group by concern (Infrastructure, API, Agent logic, UI, Config) — not by time. Enables clean reviews and safe reverts.
- **No AI tags:** Never include `Co-authored-by: Claude`, `Co-Authored-By:`, or AI attribution in commit messages.
- **Lock files:** Always stage `package-lock.json` with `package.json`. One without the other leaves dirty tree.
- **Prettier:** Every repo includes `.prettierrc` on day one. Config: `singleQuote: false`, `semi: true`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 100`. See [Prettier reference](MEMORY.md).

### Code Quality

- **File size:** 200–300 lines; exception: up to 400–500 if logic is cohesive.
- **Modular structure:** Flat co-located files (`constants.ts`, `types.ts`, `helpers.ts`). Never pre-create empty subdirectories.
- **Separation of Concerns:** Business logic out of UI components. Use API Route Handlers; keep JSX declarative.

### Naming Conventions

- **Markdown:** ALL_CAPS (e.g., `CLAUDE.md`, `README.md`)
- **React hooks:** camelCase (e.g., `useJobStatus.ts`)
- **Components:** PascalCase (e.g., `UploadZone.tsx`)
- **CDK stacks:** PascalCase with `Stack` suffix (e.g., `StorageStack`)
- **Lambda handlers:** camelCase (e.g., `ingestHandler.ts`)

### TypeScript Strictness

- **No `any` types** — use `unknown` with type guards or explicit interfaces.
- **Explicit generics:** `useState<boolean>(false)`, `useRef<HTMLInputElement>(null)`.
- **No non-null assertions** (`!`) unless provably safe.

### Destructive Git Actions — Prohibited

Never run without explicit Architect instruction:

- `git reset --hard / --soft`
- `git push --force`
- `git clean -f`, `git checkout -- .`, `git restore .`
- Force-delete branches (`-D`)
- Any command discarding commits or changes

**If commit lands on wrong branch:** Stop. Tell Architect. Ask how to proceed. Do not self-correct.

## 4. Build Phases

**All 8 phases complete** (as of 2026-04-23). See [Build Phases reference](MEMORY.md) for scope details. Follow SPEC.md for implementation order; never modify SPEC.md (kept out of version control).

## 5. App Structure

**spectra-app:** `app/` (routing only), `app/dashboard/` (main shell), `app/api/` (routes), `components/` (features + primitives), `lib/` (glue), `middleware.ts` (JWT guard).

**spectra-api:** `bin/` (CDK entry), `lib/stacks/` (CDK stacks), `src/handlers/` (Lambda functions), `src/graph/` (LangGraph + nodes), `src/lib/` (utilities), `src/lib/schemas.ts` (Zod—single source of truth), `migrations/` (SQL).

See [App Structure reference](MEMORY.md) for full directory mapping.

## 5.1 Architectural Rules

- **No Magic Strings:** All status values, modality names, NIST tags, and model IDs live in constants files.
- **Server-First:** No direct Supabase or AI API calls from client components. Use API routes or Server Actions.
- **Supabase Service Key:** Never expose `SUPABASE_SERVICE_KEY` to the client. No `NEXT_PUBLIC_` prefix.
- **Path Aliases:** `@/*` for all internal imports within each app.
- **Schemas are shared:** All agent node I/O schemas live in `spectra-api/src/lib/schemas.ts`. Import from there — never duplicate.
- **Separation of Concerns:** Business logic out of UI. JSX must be declarative.
- **No SQS, no Step Functions:** These are explicitly excluded. LangGraph handles agent orchestration; Inngest handles job lifecycle. Do not add them.
- **Lambda triggered by S3 directly:** `ingestHandler` fires on S3 `ObjectCreated`. No SQS queue between S3 and Lambda.
- **Bedrock scope:** Nova Micro only. No other Bedrock models. All other model calls go through Anthropic SDK or OpenAI SDK directly.

## 5.2 Agent Graph Rules

- **Parallel execution:** `documentNode`, `visionNode`, `audioNode` run in parallel via LangGraph branching, conditional on `activeModalities`.
- **Always sequential:** `synthesisNode` runs after all specialist nodes; `auditorNode` always runs last.
- **Schema validation on every node boundary:** Use Zod `.parse()` on input and output at each node.
- **LangSmith tracing:** The graph is wrapped with a LangSmith tracer in all environments (dev + prod).
- **PII redaction:** Applied in `documentNode` before vectorization. Reuse the Sentinel Docs pattern.
- **Session-namespaced vectors:** Upstash Vector keys prefixed with `{jobId}/{userId}/` to isolate retrieval.

## 6. Database Schema

### `jobs` table (Supabase PostgreSQL)

| Column              | Type        | Notes                                                    |
| :------------------ | :---------- | :------------------------------------------------------- |
| `id`                | uuid        | PK, `uuid_generate_v4()`                                 |
| `user_id`           | uuid        | FK → `auth.users(id)`, cascade delete                    |
| `status`            | text        | `pending` \| `processing` \| `completed` \| `failed`     |
| `created_at`        | timestamptz | default `now()`                                          |
| `completed_at`      | timestamptz | nullable                                                 |
| `result_url`        | text        | nullable                                                 |
| `confidence_scores` | jsonb       | `{ doc: number, vision: number, audio: number }`         |
| `governance_trace`  | jsonb       | `[{ timestamp, agent, finding, confidence, nistTag }]`   |
| `modalities_used`   | jsonb       | `{ document: boolean, vision: boolean, audio: boolean }` |
| `error`             | text        | nullable — error message if status is `failed`           |

- Row Level Security enabled. Users can only read/write their own jobs.
- Indexes on `user_id`, `created_at DESC`, `status`.
- Migration file: `apps/spectra-api/migrations/001_jobs.sql`
- Demo seed: `apps/spectra-api/migrations/002_demo_seed.sql`

## 7. Auth & Demo Access

Auth is implemented (JWT/RBAC middleware, Supabase Auth) but the demo account has publicly visible credentials so recruiters can use the app without friction:

```
Email:    demo@spectra.app
Password: spectra-demo
```

Demo account constraints (same as all users):

- Rate limit: 3 job runs per day per IP (Upstash sliding window)
- Max file sizes: 2MB PDF, 1MB image, 30s audio
- Preset sample files available on the dashboard

The real cost guard is the CloudWatch billing alarm at **$15/month** — not the rate limit.

## 8. UI Theme

Dark, analyst-grade theme. See [UI Theme reference](MEMORY.md) for colors, typography, components, and CSS rules.

**Key rules:** CSS modules or inline styles in feature components (no Tailwind inside `UploadZone`, `AgentGraph`, etc.). Tailwind permitted for page layout only. Modality icons via `lucide-react`; never emoji. Processing nodes use CSS animations. Citations styled as terminal tags.

## 9. LLM Integration Rules

### Model-to-Task Mapping (enforced — do not deviate)

| Agent     | Model                | Reason                                         |
| :-------- | :------------------- | :--------------------------------------------- |
| Router    | Nova Micro (Bedrock) | Classification only — cheapest correct model   |
| Document  | Claude Sonnet        | RAG + grounded citation extraction             |
| Vision    | GPT-4o               | Best native image understanding                |
| Audio     | Whisper → Sonnet     | Transcription then structured extraction       |
| Synthesis | GPT-4o               | Merging + conflict resolution                  |
| Auditor   | Claude Sonnet        | Faithfulness scoring + hallucination detection |

### Input Validation

All user-supplied file content is treated as untrusted input. Apply PII redaction before vectorization. Zod `.parse()` on every node boundary.

### LangSmith

`LANGCHAIN_TRACING_V2=true` and `LANGSMITH_PROJECT=spectra` in all environments. Wrap the LangGraph graph with a LangSmith tracer before export.

## 10. Environment Variables

See [Environment Variables reference](MEMORY.md) for `.env.local` and `.env` templates. Never expose `SUPABASE_SERVICE_KEY` to the client (no `NEXT_PUBLIC_` prefix). Use `.env.example` files in each app as source of truth for required keys.

## 11. Operational Commands

See [Operational Commands reference](MEMORY.md) for npm scripts in spectra-app and spectra-api.

## 12. Documentation & Governance

After each Phase: update the releavant sections in the following papers (if not necessary, do not review the entire file, to save tokens!): `README.md`, `ARCHITECTURE_FLOWS.md`, and supplementary papers (e.g., `TECHNICAL_ADVISORY.md`, `HARDENING_ROADMAP.md`). Update MEMORY.md entries if project state changes.

**Never modify `SPEC.md`** — it is the immutable spec (kept out of version control).
