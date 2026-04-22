# SPECTRA AI | Architecture & Governance

## 1. Project Intent

Spectra AI is a multimodal intelligence agent that routes documents, images, and audio through a specialist multi-agent graph — Document, Vision, and Audio agents processing in parallel, a Synthesis agent merging findings with per-modality citations, and an LLM-as-Judge Auditor scoring faithfulness across all three.

Built on LangGraph, Claude Sonnet, GPT-4o, and Whisper, with AWS infrastructure (S3, Lambda, Bedrock), Inngest for job orchestration, and a live agent status dashboard streaming results in real time. The Router Agent runs on AWS Bedrock (Nova Micro) for cost-optimized classification, while quality-critical nodes use Claude Sonnet for grounded synthesis and GPT-4o for native image understanding — deliberately matching model capability to task rather than defaulting to a single provider.

Portfolio-scale project. AWS free tier priority. Hard billing ceiling at 15/month via CloudWatch alarm.

## 2. Technical Stack

### spectra-app (Frontend — Vercel)

- **Framework:** Next.js 16 App Router
- **Language:** TypeScript — strict mode, no exceptions
- **UI:** Tailwind CSS 4 (layout/spacing only), CSS variables for theming, `lucide-react` for icons
- **AI (streaming):** Vercel AI SDK (`ai`) — streaming synthesis output to UI
- **Schema validation:** Zod
- **Auth:** JWT/RBAC — middleware guard on `/dashboard`
- **Database client:** Supabase JS SDK
- **Rate limiting:** `@upstash/ratelimit` + `@upstash/redis`
- **Job orchestration:** Inngest serve handler at `/api/inngest`
- **Error tracking:** Sentry (`@sentry/nextjs`)
- **Deployment:** Vercel

### spectra-api (Backend — AWS)

- **IaC:** AWS CDK (TypeScript)
- **Compute:** AWS Lambda (two functions: `ingestHandler`, `jobProcessor`)
- **Storage:** AWS S3 (`spectra-uploads` bucket)
- **AI routing:** AWS Bedrock — Nova Micro (`amazon.nova-micro-v1:0`) for Router Agent only
- **Agent orchestration:** LangGraph (StateGraph, parallel branching, checkpointing)
- **Tracing:** LangSmith (end-to-end across all agent nodes)
- **Models:**
  - Router: Nova Micro (Bedrock)
  - Document Agent: Claude Sonnet (Anthropic SDK)
  - Vision Agent: GPT-4o (OpenAI API)
  - Audio Agent: Whisper (OpenAI API) + Claude Sonnet for extraction
  - Synthesis Agent: GPT-4o (OpenAI API)
  - Auditor: Claude Sonnet (Anthropic SDK)
- **Embeddings:** `text-embedding-3-small`
- **Vector store:** Upstash Vector (session-namespaced)
- **Checkpointing / rate limiting:** Upstash Redis
- **Document parsing:** LangChain document loaders / pdf2json
- **Database:** Supabase PostgreSQL (jobs table + Auth)
- **Job lifecycle:** Inngest (triggers, retries, state tracking between Next.js and Lambda)
- **Email:** SNS (billing alarm notifications via CloudWatch)
- **Monitoring:** UptimeRobot, CloudWatch, Sentry
- **CI/Testing:** Vitest (unit), Playwright (E2E), GitHub Actions

## 2.1 Version Governance & Stability Lock

**Strict Version Policy:** Locked to **Next.js 16.2.4** and the dependency versions installed during Phase 1 scaffold. Do not upgrade without an explicit decision from the Architect.

- Do not use React 19-specific APIs unless already present in the scaffold.
- If an "upgrade available" notice appears, ignore it.

## 3. Development Workflow Hygiene (The Sprint Protocol)

### Branching & Structure

- **Repo Layout:** `spectra/` is the root container. `apps/spectra-app/` and `apps/spectra-api/` are independently deployable sub-projects, each with their own `package.json`.
- **Feature Branches:** `feat/`, `fix/`, `refactor/` — **always required** for any UI change, refactor, or code change. Only documentation updates (`.md` files) may be committed directly to `main`.
- **No Merges:** Pushing to remote is encouraged, but merging is restricted to the Architect (User).
- **Branch Hygiene Gate:** Before creating any new branch, run `git branch --merged` and delete any merged local branches. If genuinely unmerged branches exist, stop and alert the Architect — never create a new branch or merge until older branches are resolved and the Architect confirms CI is green.

### Commits & Code Quality

- **Atomic Commits:** Group changed files meaningfully. Separate concerns across multiple commits (not just 1-2) where applicable:
  1. Infrastructure / IaC
  2. API Routes / Lambda handlers
  3. Agent logic / LangGraph graph
  4. UI / Components
  5. Config / Env / CI
- **Commit Metadata:** Never include "Co-authored-by: Claude", "Co-Authored-By:", or any AI attribution tags in commit messages.
- **Lock file rule:** Always stage `package-lock.json` alongside `package.json`. Every `npm install` updates both — committing one without the other leaves a dirty working tree.
- **Prettier config:** Every new repo or sub-app must include a `.prettierrc` at its root on day one. Config: `singleQuote: false` (double quotes), `semi: true`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 100`. Run `prettier --write "**/*.{ts,tsx}"` after adding the config to normalize existing files.
- **Build Order is Strict:** Follow the phase sequence in SPEC.md. Do not implement a later phase while an earlier one is incomplete.
- **SPEC.md is immutable:** Never modify SPEC.md. It is kept out of version control (see `.gitignore`).
- **Platform steps:** After each Phase, alert the Architect with a list of AWS Console / external platform steps required to support the changes (e.g., enabling Bedrock model access, creating Supabase project, adding Inngest app, setting Upstash env vars).
- **Thin entrypoints:** Keep files to approx. 200–300 lines. Exception: sequential functions that cannot be split without losing cohesion may go up to 400–500 lines.
- **Modular Architecture:**
  - **Extraction:** Extract logic into co-located flat files within the same directory (e.g., `constants.ts`, `types.ts`, `helpers.ts`, `validation.ts`). Only create subdirectories when there are files to put in them — never pre-create empty folders. A `hooks/` folder with nothing in it is a red flag. See `apps/spectra-app/app/dashboard/` as the reference.
  - **Separation of Concerns:** Keep agent/RAG/AI logic out of UI components. Use API Route Handlers (`apps/spectra-app/app/api/`) for pipeline execution and maintain clean, declarative JSX.

### Naming Conventions

- **Markdown files:** ALL_CAPS names (e.g. `CLAUDE.md`, `README.md`). Extension lowercase.
- **React hooks:** camelCase filenames (e.g. `useJobStatus.ts`).
- **Components:** PascalCase filenames (e.g. `UploadZone.tsx`).
- **CDK stacks:** PascalCase with `Stack` suffix (e.g. `StorageStack`).
- **Lambda handlers:** camelCase (e.g. `ingestHandler.ts`).

### TypeScript Strictness

- **No `any` types.** Use `unknown` with a type guard, explicit interfaces, or `Record<string, unknown>`.
- **Explicit `useState` generics:** `useState<boolean>(false)`, `useState<Job | null>(null)`.
- **Explicit `useRef` generics:** `useRef<HTMLInputElement>(null)`.
- **Strict null checks:** No non-null assertions (`!`) unless provably safe.

### Destructive Git Actions — Absolute Prohibition

**Never run any of the following without explicit written instruction from the Architect:**

- `git reset --hard`
- `git reset --soft` or `git reset` on shared branches
- `git push --force` or `git push --force-with-lease`
- `git clean -f` / `git clean -fd`
- `git checkout -- .` or `git restore .`
- Deleting branches with `-D` (force delete)
- Any command that discards commits or working tree changes

If a commit lands on the wrong branch: **stop, tell the Architect what happened, and ask how to proceed.** Do not attempt to self-correct with destructive commands. The Architect decides.

## 4. Build Phases

| Phase | Area                                                                                           | Status         |
| :---- | :--------------------------------------------------------------------------------------------- | :------------- |
| 1     | Monorepo shell + CDK scaffold + Next.js scaffold                                               | ✅ Complete    |
| 2     | LangGraph agent graph + Inngest + API surface                                                  | ✅ Complete    |
| 3     | UploadZone + AgentGraph components + SynthesisPanel + GovernanceTrace                          | ✅ Complete    |
| 4     | Integration + hardening (Inngest wire-up, JWT/RBAC, PII redaction, Sentry, Vitest, Playwright) | ✅ Complete    |
| 5     | AWS deployment (cdk deploy, Lambda concurrency, env vars, UptimeRobot)                         | ✅ Complete    |
| 6     | Prompt injection detection, NIST control IDs, LangSmith evaluators, citation deep-linking, synthesis guardrails, accessibility | ✅ Complete |
| 7     | Red team test suite — adversarial injection, PII redaction coverage, synthesis guardrail validation                            | ✅ Complete |
| 8     | Hardening — Lambda warmup + concurrency cap, CORS locking, auth rate limiting, JWT refresh, S3 pre-signed URLs, CloudWatch error alarms, vector cleanup, chunk quality filtering, deduplication, retrieval eval harness | ✅ Complete |

## 5. App Structure

### spectra-app Directory Mapping

| Area                        | Purpose                                                                                                                                                                               |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/`                      | **Routing Only:** `page.tsx`, `layout.tsx`, `loading.tsx`. Minimal logic.                                                                                                             |
| `app/dashboard/`            | Main app shell — upload zone, agent graph, synthesis panel.                                                                                                                           |
| `app/dashboard/job/[id]/`   | Job detail — full report, governance trace, citations, LLM-as-Judge scores.                                                                                                           |
| `app/dashboard/history/`    | Past job runs list.                                                                                                                                                                   |
| `app/dashboard/governance/` | Full NIST AI RMF compliance ledger.                                                                                                                                                   |
| `app/api/`                  | API Routes: `/api/upload`, `/api/job/[id]`, `/api/job/[id]/trace`, `/api/auth/token`, `/api/inngest`.                                                                                 |
| `components/`               | Feature components: `UploadZone`, `AgentGraph`, `SynthesisPanel`, `GovernanceTrace`, `ConfidenceBar`. Shared primitives: `AzureButton`, `ModalityCard`, `GlassPanel`, `SectionLabel`. |
| `lib/`                      | Glue: `api.ts`, `types.ts`, `constants.ts`, Supabase client, JWT helpers, Inngest client.                                                                                             |
| `middleware.ts`             | JWT auth guard — protects all `/dashboard` routes.                                                                                                                                    |

### spectra-api Directory Mapping

| Area                 | Purpose                                                                                                                             |
| :------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `bin/`               | CDK app entry point.                                                                                                                |
| `lib/stacks/`        | CDK stacks: `StorageStack`, `ComputeStack`, `ObservabilityStack`.                                                                   |
| `src/handlers/`      | Lambda handlers: `ingestHandler.ts`, `jobProcessor.ts`.                                                                             |
| `src/graph/`         | LangGraph agent graph: `graph.ts`, node files, `state.ts`.                                                                          |
| `src/graph/nodes/`   | One file per agent node: `routerNode.ts`, `documentNode.ts`, `visionNode.ts`, `audioNode.ts`, `synthesisNode.ts`, `auditorNode.ts`. |
| `src/lib/`           | Shared utilities: Bedrock client, S3 client, Supabase client, PII redaction.                                                        |
| `src/lib/schemas.ts` | **Single source of truth** — all Zod schemas for node I/O, exported for reuse.                                                      |
| `migrations/`        | Supabase SQL migration files.                                                                                                       |

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

Dark, precise, analyst-grade. Not a generic SaaS dashboard — closer to an intelligence workstation.

### Color Tokens (CSS variables in `globals.css`)

| Variable            | Value     | Usage                                             |
| :------------------ | :-------- | :------------------------------------------------ |
| `--bg`              | `#060609` | App shell background                              |
| `--surface`         | `#111116` | Cards, panels                                     |
| `--border`          | `#1e1e26` | Subtle borders                                    |
| `--accent`          | `#00f2ff` | Cyan — active states, labels, AzureButton         |
| `--text-primary`    | `#e8e6df` | Body text                                         |
| `--text-secondary`  | `#6b6a63` | Metadata, labels                                  |
| `--modality-doc`    | `#2dd4bf` | Document agent — FileText icon / confidence bar   |
| `--modality-vision` | `#38bdf8` | Vision agent — Aperture icon / confidence bar     |
| `--modality-audio`  | `#f87171` | Audio agent — AudioWaveform icon / confidence bar |

### Typography

- UI labels, navigation, controls: clean sans-serif
- Agent output, trace log, citations: `font-family: monospace`
- Wordmark: `letter-spacing: -0.04em`, weight 800, white-to-silver gradient (`linear-gradient(to bottom, #fff 40%, rgba(255,255,255,0.4))`)
- Section labels: monospace, `#00f2ff` at 0.8 opacity, `letter-spacing: 0.15em`, uppercase

### Atmospheric Background

All pages use a shared three-layer background applied as inline `backgroundImage`:

```
radial-gradient(circle at 50% -20%, rgba(0,242,255,0.12–0.15) 0%, transparent 40%)  ← cyan top vignette
linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)                         ← horizontal grid
linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)                  ← vertical grid
```

`backgroundSize: '100% 100%, 40px 40px, 40px 40px'`

Cards (`ModalityCard`, `GlassPanel`) repeat the same grid overlay internally via an absolutely-positioned `div` so the grid lines are consistent at every depth.

### Shared Primitive Components

| Component      | Purpose                                                                                                                                                                             |
| :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AzureButton`  | CTA button — cyan `#00f2ff`, pill shape (`border-radius: 50px`), weight 800. Renders `<a>` when `href` is passed, `<button>` otherwise.                                             |
| `GlassPanel`   | Surface container — `rgba(255,255,255,0.03)` background, `backdropFilter: blur(25px)`, `border-radius: 24px`.                                                                       |
| `ModalityCard` | Modality feature card — accepts `icon: LucideIcon`, `color`, `label`, `detail`, `sub`. Icon rendered inside a tinted badge (`color + '15'` background, `color + '30'` border).      |
| `SectionLabel` | Panel header label — monospace, `#00f2ff`, 0.8 opacity, uppercase, `letter-spacing: 0.15em`.                                                                                        |
| `GhostButton`  | Secondary ghost/outline button — muted border and text, hover lightens both. Renders `<a>` when `href` passed, `<button>` otherwise. Use for back-navigation and secondary actions. |

### Component Style Rules

- Use **CSS modules or inline styles** inside feature components — no Tailwind utility classes inside `UploadZone`, `AgentGraph`, `SynthesisPanel`, `GovernanceTrace`.
- Tailwind is permitted for layout scaffolding in page files only.
- Modality icons use `lucide-react` `LucideIcon` components — never emoji strings.
- Processing nodes show a soft cyan pulsing ring via CSS animation (not JS).
- Citation badges styled as terminal tags: `[D1]` teal, `[V2]` sky blue, `[A1]` coral.

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

### spectra-app (`.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
JWT_SECRET=your_jwt_secret_here
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here
UPSTASH_REDIS_URL=your_upstash_redis_url_here
UPSTASH_REDIS_TOKEN=your_upstash_redis_token_here
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_here
AWS_LAMBDA_JOB_PROCESSOR_NAME=spectra-job-processor
INNGEST_SIGNING_KEY=your_inngest_signing_key_here
INNGEST_EVENT_KEY=your_inngest_event_key_here
```

### spectra-api (`.env`)

```bash
AWS_REGION=eu-west-1
AWS_ACCOUNT_ID=your_aws_account_id_here
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_here
S3_BUCKET_NAME=spectra-uploads
BEDROCK_NOVA_MICRO_MODEL_ID=amazon.nova-micro-v1:0
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_WHISPER_API_KEY=your_openai_whisper_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here
UPSTASH_VECTOR_URL=your_upstash_vector_url_here
UPSTASH_VECTOR_TOKEN=your_upstash_vector_token_here
UPSTASH_REDIS_URL=your_upstash_redis_url_here
UPSTASH_REDIS_TOKEN=your_upstash_redis_token_here
LANGSMITH_API_KEY=your_langsmith_api_key_here
LANGSMITH_PROJECT=spectra
LANGCHAIN_TRACING_V2=true
INNGEST_SIGNING_KEY=your_inngest_signing_key_here
SENTRY_DSN=your_sentry_dsn_here
```

## 11. Operational Commands

### spectra-app

```bash
npm run dev            # Start Next.js 16 dev server (port 3000)
npm run build          # Production build
npm run lint           # ESLint (app/, components/, lib/)
npm run type-check     # tsc --noEmit
npm run test           # Vitest unit tests (single run)
npm run test:watch     # Vitest watch mode
npm run test:coverage  # Vitest with v8 coverage report
npm run test:e2e       # Playwright E2E
npm run test:e2e:ui    # Playwright interactive UI mode
npm run audit:high     # npm audit --audit-level=high
```

### spectra-api

```bash
npm run build        # tsc compile
npm run cdk:diff     # CDK diff against deployed stack
npm run cdk:deploy   # Deploy all CDK stacks
npm run test         # Vitest unit tests on schemas + routing logic
```

## 12. Update Papers

`CLAUDE.md`, `README.md`, `ARCHITECTURE_FLOWS.md`, and any other papers (e.g. `TECHNICAL_ADVISORY.md`, `HARDENING_ROADMAP.md`) must be reviewed and updated after each implemented Phase. `SPEC.md` is **never** modified by Claude.
