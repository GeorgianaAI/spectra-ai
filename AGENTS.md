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

## 3. Denied Permission to Secret File Access

Hard rule: **never** read, search, open, cat, grep, ripgrep, summarize, or inspect real secret-bearing files **under any circumstance** unless the user explicitly overrides this rule for the current task. This includes `.env`, `.env.local`, `.env.development`, `.env.production`, `.env.test`, any other real secret `.env.*` variants, `*.pem`, `*.key`, and `~/.ssh/**`. If a task requires knowing which keys or variables exist, read `.env.example` only. If a task appears to require actual secret values from a real env file, stop and ask the user instead of accessing that file.

## 4. Commits

**Never** include "Co-authored-by:" or any AI attribution tags in commit messages.
Split commits for separation of concerns
