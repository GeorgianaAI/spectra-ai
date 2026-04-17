# spectra-api

AWS CDK + Lambda backend for Spectra AI. Independently deployable — no shared build system with `spectra-app`.

## Stack

- **IaC:** AWS CDK (TypeScript)
- **Compute:** AWS Lambda (Node.js 20.x)
- **Storage:** S3 (`spectra-uploads`)
- **AI routing:** AWS Bedrock — Nova Micro (`amazon.nova-micro-v1:0`)
- **Agent graph:** LangGraph (Phase 2)
- **Database:** Supabase PostgreSQL

## CDK Stacks

| Stack                  | Resources                                                          |
| :--------------------- | :----------------------------------------------------------------- |
| `SpectraStorageStack`  | S3 bucket, versioning, lifecycle, CORS, ObjectCreated notification |
| `SpectraComputeStack`  | `ingestHandler` Lambda, `jobProcessor` Lambda, CloudWatch log groups |
| `SpectraObservabilityStack` | CloudWatch billing alarm ($20), Lambda dashboard              |

## Prerequisites

1. [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) configured with your credentials
2. [AWS CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/cli.html) installed globally: `npm install -g aws-cdk`
3. CDK bootstrapped in your account/region (one-time):
   ```bash
   cdk bootstrap aws://YOUR_ACCOUNT_ID/eu-west-1
   ```

## Setup

```bash
cp .env.example .env
# Fill in all values in .env
npm install
npm run build
```

## Deploy

```bash
npm run cdk:diff    # preview changes
npm run cdk:deploy  # deploy all stacks
```

## Database Migrations

Run these in order in the Supabase SQL editor:

1. `migrations/001_jobs.sql` — create jobs table, RLS policies, indexes
2. `migrations/002_demo_seed.sql` — create demo user (`demo@spectra.app` / `spectra-demo`)

## Local Development

Lambda handlers can be tested locally using the AWS SAM CLI or by invoking them directly with the AWS CLI after deployment. Full local emulation is not configured at this phase.

## Project Structure

```
spectra-api/
├── bin/
│   └── spectra-api.ts         ← CDK app entry point
├── lib/
│   └── stacks/
│       ├── storage-stack.ts   ← S3 bucket
│       ├── compute-stack.ts   ← Lambda functions
│       └── observability-stack.ts ← CloudWatch alarms + dashboard
├── src/
│   ├── handlers/
│   │   ├── ingestHandler.ts   ← S3 trigger handler (stub)
│   │   └── jobProcessor.ts    ← Inngest HTTP handler (stub)
│   ├── graph/                 ← LangGraph agent graph (Phase 2)
│   │   └── nodes/
│   └── lib/
│       └── bedrock-client.ts  ← Nova Micro Bedrock client
├── migrations/
│   ├── 001_jobs.sql
│   └── 002_demo_seed.sql
├── cdk.json
├── tsconfig.json
└── .env.example
```
