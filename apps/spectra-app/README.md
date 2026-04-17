# spectra-app

Next.js 16 frontend for Spectra AI. Independently deployable to Vercel — no shared build system with `spectra-api`.

## Stack

- **Framework:** Next.js 16 App Router
- **Language:** TypeScript (strict mode)
- **UI:** Tailwind CSS 4 (layout only), CSS variables for dark theme
- **AI streaming:** Vercel AI SDK (`ai`)
- **Schema validation:** Zod
- **Auth:** JWT/RBAC (middleware guard on `/dashboard`)
- **Database:** Supabase JS SDK
- **Rate limiting:** Upstash Redis (`@upstash/ratelimit`)
- **Job orchestration:** Inngest serve handler
- **Error tracking:** Sentry (`@sentry/nextjs`)

## Setup

```bash
cp .env.example .env.local
# Fill in all values
npm install
npm run dev
```

## Routes

### Public

| Route         | Description                              |
| :------------ | :--------------------------------------- |
| `/`           | Landing page with demo credentials       |
| `/auth/login` | Login form (demo credentials pre-filled) |

### Protected (JWT required)

| Route                   | Description                               |
| :---------------------- | :---------------------------------------- |
| `/dashboard`            | Main app — upload, agent graph, synthesis |
| `/dashboard/job/[id]`   | Full job report, governance trace         |
| `/dashboard/history`    | Past job runs                             |
| `/dashboard/governance` | NIST AI RMF compliance ledger             |

### API

| Route                 | Method | Description                        |
| :-------------------- | :----- | :--------------------------------- |
| `/api/upload`         | POST   | Upload files, trigger job pipeline |
| `/api/job/[id]`       | GET    | Job status + result                |
| `/api/job/[id]/trace` | GET    | Governance trace entries           |
| `/api/auth/token`     | POST   | Issue JWT                          |
| `/api/inngest`        | POST   | Inngest serve handler              |

## Demo Access

```
Email:    demo@spectra.app
Password: spectra-demo
```

Credentials are shown on the landing page. The demo account is a regular user subject to the same rate limits (3 runs/day/IP).

## Project Structure

```
spectra-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    ← Landing page
│   ├── auth/login/page.tsx
│   ├── dashboard/
│   │   ├── page.tsx                ← Main dashboard
│   │   ├── job/[id]/page.tsx
│   │   ├── history/page.tsx
│   │   └── governance/page.tsx
│   └── api/
│       ├── upload/route.ts
│       ├── job/[id]/route.ts
│       ├── job/[id]/trace/route.ts
│       ├── auth/token/route.ts
│       └── inngest/route.ts
├── components/
│   ├── UploadZone.tsx
│   ├── AgentGraph.tsx
│   ├── SynthesisPanel.tsx
│   ├── ConfidenceBar.tsx
│   └── GovernanceTrace.tsx
├── lib/
│   ├── api.ts
│   ├── types.ts
│   └── constants.ts
├── middleware.ts                    ← JWT guard on /dashboard
└── .env.example
```
