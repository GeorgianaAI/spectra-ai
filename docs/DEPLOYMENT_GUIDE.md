# 🚀 Spectra AI — Deployment Guide

This guide covers deploying both **spectra-api** (AWS Lambda/CDK) and **spectra-app** (Vercel) to production.

---

## 🔑 Frontend Architecture: Direct-to-Service

There is **no `NEXT_PUBLIC_API_URL`** in spectra-app. The Next.js API routes (`/api/*`) act as thin clients that directly coordinate with AWS and third-party services, rather than proxying through a remote Lambda API.

The frontend communicates directly with:

- **S3** for file uploads (via AWS SDK in route handlers)
- **Supabase** for database operations  
- **Upstash Redis** for rate limiting
- **Inngest** for job orchestration

This **direct-to-service** design is documented in [ARCHITECTURE_FLOWS.md](./ARCHITECTURE_FLOWS.md) (see sections 1–2). The backend Lambda (`jobProcessor`) is invoked only by Inngest, never directly by the frontend.

---

## Prerequisites

Before deploying, ensure you have:

- **Node.js 20+**
- **AWS CLI** configured (`aws configure`) with appropriate credentials
- **AWS CDK CLI**: `npm install -g aws-cdk`
- **CDK bootstrapped** for your region: `cdk bootstrap aws://ACCOUNT/REGION` (e.g., `eu-west-1`)
- **Supabase project** created (free tier is sufficient)
- **Upstash Vector** database created for embeddings
- **Upstash Redis** database created for checkpointing and rate limiting
- **Inngest account** (free tier supports local dev + production)
- **LangSmith account** for agent tracing (free tier available)
- **OpenAI API key** (for GPT-4o Vision, Synthesis, Whisper)
- **Anthropic API key** (for Claude Sonnet)
- **Vercel account** (for spectra-app deployment)

---

## Backend Deployment (spectra-api)

### 1. Environment Setup

```bash
cd apps/spectra-api
cp .env.example .env
```

Fill in all values in `.env`. Critical variables:

- **AWS credentials** — handled by `aws configure`
- **SUPABASE_URL** & **SUPABASE_SERVICE_KEY** — from Supabase dashboard
- **ANTHROPIC_API_KEY** — from Anthropic console
- **OPENAI_API_KEY** & **OPENAI_WHISPER_API_KEY** — from OpenAI dashboard
- **INNGEST_EVENT_KEY** & **INNGEST_SIGNING_KEY** — from Inngest dashboard
- **LANGSMITH_API_KEY** & **LANGSMITH_PROJECT** — from LangSmith dashboard
- **UPSTASH_VECTOR_REST_URL/TOKEN** — from Upstash console
- **UPSTASH_REDIS_REST_URL/TOKEN** — from Upstash console
- **BEDROCK_NOVA_MICRO_MODEL_ID** — cross-region inference profile: `eu.amazon.nova-micro-v1:0` (bare model IDs rejected by AWS — see TECHNICAL_ADVISORY.md §2)
- **BILLING_ALERT_EMAIL** — your email for CloudWatch alerts (hard ceiling: $15/month)
- **PRODUCTION_ORIGIN** — your Vercel domain (e.g., `https://spectra-ai-app.vercel.app`)
- **JWT_SECRET** — shared secret with spectra-app (generate: `openssl rand -base64 32`)

### 2. Install & Build

```bash
npm install
npm run build
```

### 3. Preview Changes

```bash
npm run cdk:diff
```

Review the diff to ensure no unexpected resources are being created.

### 4. Deploy to AWS

```bash
npm run cdk:deploy
```

CDK will:
- Create S3 bucket for uploads
- Deploy `ingestHandler` Lambda (triggered by S3 ObjectCreated)
- Deploy `jobProcessor` Lambda (invoked by Inngest)
- Configure IAM roles, CloudWatch logs, and billing alarms
- Output stack names and resource ARNs

**Save the CDK outputs** — you'll need them for the frontend.

### 5. Database Migrations

Run Supabase migrations in order to set up the `jobs` table and demo seed data:

```bash
# Copy the migration SQL from apps/spectra-api/migrations/001_jobs.sql
# Paste into Supabase SQL Editor and run

# Then run migrations/002_demo_seed.sql for the demo account
```

Or use the Supabase CLI:
```bash
supabase db push --project-ref <your-project-ref>
```

---

## Frontend Deployment (spectra-app)

### 1. Environment Setup

```bash
cd apps/spectra-app
cp .env.example .env.local
```

Fill in all values in `.env.local`:

- **AWS_REGION** — same region as your backend (e.g., `eu-west-1`)
- **NEXT_PUBLIC_SUPABASE_URL** & **NEXT_PUBLIC_SUPABASE_ANON_KEY** — from Supabase dashboard
- **SUPABASE_SERVICE_KEY** — from Supabase dashboard (for server-side operations)
- **UPSTASH_REDIS_REST_URL** & **UPSTASH_REDIS_REST_TOKEN** — from Upstash console (for rate limiting)
- **JWT_SECRET** — **must match spectra-api** (the shared secret)

### 2. Local Testing

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to test locally. Verify:
- Upload flows work (files → S3)
- Rate limiting kicks in: 3/day on upload, 10/hr on auth/token, 5/min on auth/refresh, 60/min on job read endpoints
- Supabase queries work (job creation, history)
- JWT auth works (middleware)

### 3. Deploy to Vercel

#### Option A: Git Integration (Recommended)

1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/)
3. Click **Add New...** → **Project**
4. Select your GitHub repository
5. Set **Root Directory** to `apps/spectra-app`
6. Add all environment variables from `.env.local` to Vercel's Environment Variables
7. Click **Deploy**

Vercel will auto-deploy on every push to `main`.

#### Option B: CLI Deployment

```bash
npm install -g vercel
vercel login
vercel deploy --prod
```

### 4. Post-Deployment

After Vercel deployment:

1. **Update `PRODUCTION_ORIGIN`** in spectra-api `.env` to your Vercel URL (e.g., `https://spectra-ai-app.vercel.app`)
2. **Redeploy spectra-api** to apply the new origin for CORS:
   ```bash
   cd apps/spectra-api
   npm run cdk:deploy
   ```
3. **Update GitHub Actions secrets** (see below) if using CI/CD workflows
4. **Test the production deployment** — upload a file and confirm the full pipeline works

---

## GitHub Actions CI/CD Workflows

Spectra AI uses two GitHub Actions workflows for pull request validation and dependency audits. Supabase keep-alive is handled by pg_cron running inside Supabase's own Postgres infrastructure (see [pg_cron — Supabase Keep-Alive](#pg_cron--supabase-keep-alive) below).

### ci.yml — Pull Request Quality Gates

**Trigger:** Every pull request (across all code).

**What it runs:**

- Lint (ESLint for spectra-app, Node.js API for spectra-api)
- Type check (`tsc --noEmit` for TypeScript)
- Build (`next build` for spectra-app)
- Unit tests (Vitest for spectra-app)
- E2E tests (Playwright for spectra-app)

**Blocks merge if:** Any check fails.

**Key characteristic:** **Required** — all PRs must pass before merge.

### scheduled-audit.yml — Dependency Security Audit

A **scheduled dependency audit** runs automatically on the 1st of each month at 09:00 UTC to catch vulnerabilities between commits. Manually trigger via `workflow_dispatch` in the Actions tab at any time. The workflow reports only — it does not auto-fix.

**Trigger:**

- **Automatic:** 1st of every month at 09:00 UTC
- **Manual:** via `workflow_dispatch` in GitHub Actions tab

**What it does:**

- Runs `npm audit` on spectra-app and spectra-api
- **Reports vulnerabilities only** — does not auto-fix

**Key characteristic:** **Manual remediation required.** If critical vulnerabilities are found, review the audit results, create a fix branch, and merge into main.

### pg_cron — Supabase Keep-Alive

Supabase free-tier projects are suspended after **7 days of inactivity**. Rather than relying on an external caller (Vercel cron, GitHub Actions, or any app-side route), the keepalive runs as a pg_cron job **inside Supabase's own Postgres infrastructure** — it fires every 3 days regardless of whether the app is deployed or running.

**Mechanism:** `pg_cron` is a Postgres extension available on all Supabase plans. The registered job runs `SELECT count(*) FROM jobs` on a `0 12 */3 * *` schedule (noon UTC every 3 days), which constitutes real database activity and resets the inactivity window.

**No external dependency:** Once configured, no app code, Vercel cron config, or GitHub secret is required to keep the project alive.

#### Setup (one-time, in Supabase SQL Editor)

**Step 1 — Enable pg_cron and register the job (paste and run together):**

```sql
create extension if not exists pg_cron;

select cron.schedule(
  'supabase-keepalive',
  '0 12 */3 * *',
  $$select count(*) from jobs$$
);
```

**Step 2 — Verify registration (paste and run separately):**

```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'supabase-keepalive';
```

You should see one row with `active = true`.

**Check execution history after it fires:**

```sql
select status, start_time, return_message
from cron.job_run_details
order by start_time desc
limit 5;
```

**Why this works:** Supabase's inactivity scanner tracks real database queries. `pg_cron` runs inside Supabase's own Postgres, so the query fires at the scheduled interval without any external trigger. The 3-day interval stays well clear of the 7-day suspension window.

---

## Monitoring & Observability

### CloudWatch Billing Alarm

The CDK stack creates a CloudWatch alarm that emails you if monthly AWS costs exceed **$15**. This is the hard ceiling for portfolio-scale operation.

Check the alarm in AWS CloudWatch → Alarms and confirm your email is set correctly.

### LangSmith Tracing

All agent graph executions are traced in LangSmith under the project `spectra`. Visit [smith.langchain.com](https://smith.langchain.com) to monitor:

- Agent execution times
- Token usage per model
- Failure rates and error patterns
- Latency trends

### Sentry Error Tracking

Full-stack error tracking for client (spectra-app) and server (Lambda). Set `SENTRY_DSN` in both environments to enable.

Visit Sentry dashboard to review:
- Client-side errors (UI crashes, fetch failures)
- Server-side errors (Lambda execution failures)
- Performance metrics

---

## Rollback & Troubleshooting

### Rollback spectra-api

To revert a CDK deployment:

```bash
cd apps/spectra-api
# Check the CloudFormation console to find the previous stack version
aws cloudformation list-stacks --region eu-west-1 --status-filter DELETE_COMPLETE
# Or manually delete resources and redeploy a known-good version
```

### Rollback spectra-app

Vercel stores all previous deployments. In the Vercel dashboard:

1. Go to **Deployments**
2. Find the previous stable deployment
3. Click **Promote to Production**

---

## Cost Management

### AWS (spectra-api)

- **Lambda**: Pay per invocation and GB-second. Typical spectra run: ~5 invocations, ~15 GB-seconds = ~$0.05
- **S3**: Pay for storage and data transfer. Uploads are versioned; old versions cost money — set a lifecycle policy to delete after 30 days if cost becomes a concern
- **Bedrock (Nova Micro)**: Charges per input/output token. Classification-only (cheap) — $0.30/1M input tokens
- **CloudWatch**: Free tier covers most usage; logs retained 2 weeks

**Billing alert:** If monthly costs exceed $15, investigate the culprit (likely repeated large audio files or unexpected Lambda invocations).

### Third-Party APIs

- **OpenAI** (GPT-4o, Whisper): Pay per token. Typical spectra run: ~$0.10–$0.20
- **Anthropic** (Claude Sonnet): Pay per token. Typical spectra run: ~$0.05–$0.10
- **Upstash Vector**: Free tier: 14-day retention. Upgrade if you need longer history
- **Upstash Redis**: Free tier: 10k commands/day. Rate limiting is ~10–100 commands/job

---

## Next Steps

- Set up monitoring dashboards (CloudWatch, LangSmith, Sentry)
- Configure custom domains (Vercel, Route 53)
- Set up backups for Supabase (automated on Pro plan)
- Plan capacity: typical free tier handles current rate limits — 3/day/IP upload, 10/hr/IP auth/token, 5/min/IP auth/refresh, 60/min/IP job reads
- Document runbook for on-call engineers (see [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md))
