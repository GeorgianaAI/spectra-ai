# Spectra AI

**Spectra AI** is a multimodal intelligence agent that routes documents, images, and audio through a specialist multi-agent graph — Document, Vision, and Audio agents processing in parallel, a Synthesis agent merging findings with per-modality citations, and an LLM-as-Judge Auditor scoring faithfulness across all three.

Built on LangGraph, Claude Sonnet, GPT-4o, and Whisper, with AWS infrastructure (S3, Lambda, Bedrock), Inngest for job orchestration, and a live agent status dashboard streaming results in real time.

---

## Repo Structure

```
spectra/
├── README.md
├── ARCHITECTURE.md
├── .github/
│   └── workflows/
├── apps/
│   ├── spectra-app/     ← Next.js 15 frontend (Vercel)
│   └── spectra-api/     ← AWS backend (CDK + Lambda)
└── docs/
    └── architecture.mermaid
```

The root has no `package.json` and no `node_modules`. It is a container with the README, architecture documentation, and GitHub Actions. Each `apps/` subdirectory is a fully independent deployable unit with its own `package.json`, `.env.example`, and `README.md`.

---

## Apps

### `apps/spectra-app` — Frontend (Vercel)

Next.js 15 App Router, TypeScript, Tailwind CSS 4.

- Accepts file uploads (PDF · image · audio) via a drag-and-drop upload zone
- POSTs to `/api/upload`, triggers Inngest event, polls `/api/job/[id]` for status
- Streams the synthesis report via Vercel AI SDK
- Live agent status panel driven by Supabase job state

See [`apps/spectra-app/README.md`](./apps/spectra-app/README.md) for setup and dev instructions.

### `apps/spectra-api` — Backend (AWS)

AWS CDK + Lambda + Bedrock + LangGraph.

- `ingestHandler` Lambda: triggered by S3 `ObjectCreated`, validates upload, fires Inngest event
- `jobProcessor` Lambda: triggered by Inngest HTTP, runs LangGraph multi-agent graph, writes results to Supabase
- Router Agent on Bedrock Nova Micro; specialist agents on Claude Sonnet, GPT-4o, Whisper

See [`apps/spectra-api/README.md`](./apps/spectra-api/README.md) for CDK bootstrap and deploy instructions.

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a full narrative and [docs/architecture.mermaid](./docs/architecture.mermaid) for the system diagram.

---

## Agent Graph

```
routerNode (Nova Micro / Bedrock)
    ↓
[documentNode (Claude Sonnet) + visionNode (GPT-4o) + audioNode (Whisper → Sonnet)]
    ↓  (parallel, conditional on active modalities)
synthesisNode (GPT-4o)
    ↓
auditorNode (Claude Sonnet — LLM-as-Judge)
    ↓
write to Supabase
```

---

## Demo

The app ships with a publicly accessible demo account (credentials shown on the landing page) so recruiters and reviewers can try the full pipeline without creating an account.

- Rate limit: 3 runs/day per IP
- Max file sizes: 2 MB PDF · 1 MB image · 30 s audio
- Sample files pre-loaded so no upload is required

---

## Tech Stack at a Glance

| Area              | Technology                                                  |
| :---------------- | :---------------------------------------------------------- |
| Frontend          | Next.js 15, TypeScript, Tailwind CSS 4, Vercel AI SDK       |
| Backend IaC       | AWS CDK (TypeScript)                                        |
| Compute           | AWS Lambda                                                  |
| AI routing        | AWS Bedrock — Nova Micro                                    |
| Agent graph       | LangGraph (TypeScript)                                      |
| Tracing           | LangSmith                                                   |
| Models            | Claude Sonnet · GPT-4o · Whisper · Nova Micro               |
| Embeddings        | text-embedding-3-small                                      |
| Vector store      | Upstash Vector                                              |
| Database          | Supabase PostgreSQL + Auth                                  |
| Job orchestration | Inngest                                                     |
| Rate limiting     | Upstash Redis                                               |
| Error tracking    | Sentry                                                      |
| CI                | GitHub Actions                                              |
