# Spectra AI — Scaling Agentic & RAG+Agentic Architectures

A design reference and trade-off guide for scaling AI systems from prototype to production — across vector stores, orchestration layers, model routing, governance, and multi-agent topologies. Grounded in the Spectra AI stack and extended to real-world industry contexts.

> **Audience:** Engineers and architects making infrastructure decisions for AI pipelines at scale. Assumes familiarity with LangGraph, vector stores, LLM APIs, and serverless compute.

---

## 1. The Scaling Axis — Four Things That Scale Differently

Before choosing any component, name which axis you are scaling on:

| Axis              | What it means                                    | Primary bottleneck                             |
| ----------------- | ------------------------------------------------ | ---------------------------------------------- |
| **Throughput**    | More jobs/requests per second                    | Compute, rate limits, connection pools         |
| **Context depth** | Longer documents, more modalities, deeper chains | Token budgets, memory, chunk strategy          |
| **Multi-tenancy** | More users with isolated data                    | Vector namespace pollution, RLS, auth overhead |
| **Governance**    | More regulated industries, stricter audit trails | Trace retention, PII coverage, lineage         |

Most system designs fail at scale because they optimised for one axis while a different one was the real constraint. Name yours early.

---

## 2. The Two Pipeline Topologies

### Pure RAG

```
User query → Embed query → Vector search → Retrieved chunks → LLM → Response
```

Simple, fast, predictable. The LLM has no agency — it reads chunks and answers. Best for Q&A, summarisation, document lookup.

**Scaling concern:** retrieval quality degrades before the LLM does. As the corpus grows, the top-k chunks become noisier. Users blame "the AI" for wrong answers when the actual failure is in the vector index.

### Agentic (LangGraph / multi-agent graph)

```
User input → Router → [DocAgent || VisionAgent || AudioAgent] → SynthesisAgent → AuditorAgent → Output
```

The LLM decides what to do next. Agents can branch, loop, call tools, and hand off to other agents. Enables complex multi-step reasoning. Best for multi-modal analysis, research pipelines, decision-support systems.

**Scaling concern:** chains are non-deterministic. A 5-node chain with one probabilistic step is manageable. A 12-node chain where 4 nodes can branch introduces exponential failure surface. Every added node multiplies both latency variance and the probability of a silent failure.

### Mixed RAG + Agentic (Spectra's topology)

```
User input → Router Agent (Nova Micro)
  → DocumentAgent: inject detection → PII redact → embed → vector upsert → RAG retrieve → Claude Sonnet
  → VisionAgent: raw bytes → GPT-4o → output guardrails → PII redact
  → AudioAgent: Whisper → inject check → PII redact → Claude Sonnet
→ SynthesisAgent (GPT-4o): merge + cite
→ AuditorAgent (Claude Sonnet): faithfulness score
→ Supabase write
```

The Router is agentic (decides which modalities to activate). Each specialist node is RAG-enhanced (document agent uses vector retrieval). The Synthesis and Auditor are pure LLM reasoning nodes.

**Why mixed is the production pattern:** pure RAG has no reasoning over conflicts between sources. Pure agentic has no grounding, hallucinates freely. Mixed gives you grounded, reasoned, auditable output.

---

## 3. Vector Store Selection at Scale

The choice of vector store is the most consequential infrastructure decision in a RAG or RAG+agentic system. Here are the real trade-offs beyond the marketing pages.

### Upstash Vector (Spectra's current choice)

|                          |                                                                 |
| ------------------------ | --------------------------------------------------------------- |
| **Best for**             | Serverless, edge-deployed, low-to-medium scale, cost-sensitive  |
| **Pricing model**        | Per query + per write + storage GB                              |
| **Consistency**          | Eventual — upsert then immediate query may return stale results |
| **Namespacing**          | Namespace-level isolation (Spectra uses `{jobId}/{userId}/`)    |
| **Max index size**       | Scales reasonably but not designed for 100M+ vectors            |
| **Operational overhead** | Near-zero — fully managed                                       |

**Hidden cost at scale:** at 10,000 jobs/month with 50 chunks/job = 500,000 upserts/month. Upstash charges per write. At high throughput, write costs exceed query costs. Profile writes before assuming reads are the bottleneck.

**Consistency trap:** upsert in `documentNode`, then immediately query in the same node. If the upsert hasn't propagated, the RAG retrieval returns zero chunks. The LLM answers from parametric memory with no grounding signal — silently. You need a propagation delay or a read-your-writes consistency guarantee.

---

### Pinecone

|                          |                                                                         |
| ------------------------ | ----------------------------------------------------------------------- |
| **Best for**             | Production-scale, high-QPS, enterprise teams                            |
| **Pricing model**        | Per pod/serverless unit — fixed cost at scale rather than per-operation |
| **Consistency**          | Strong within a namespace after upsert (serverless: eventual)           |
| **Namespacing**          | Built-in namespace isolation per index                                  |
| **Max index size**       | Designed for billions of vectors — this is its strength                 |
| **Operational overhead** | Low — managed, but requires index configuration decisions upfront       |

**Trade-off vs Upstash:** Pinecone's serverless tier is also eventually consistent. Pinecone's pod-based tier has strong consistency but costs $70+/month at minimum. You pay for always-on capacity, not per-query — which is cheaper at scale, expensive at low volume.

**Migration trap:** you cannot migrate from Upstash Vector to Pinecone without re-embedding your entire corpus. Embedding models are not interoperable. If you switch from `text-embedding-3-small` (OpenAI, 1536d) to `embed-english-v3` (Cohere, 1024d), every vector in your index is invalid. Re-indexing a 10M-chunk corpus takes hours and API cost.

**Hybrid search:** Pinecone supports sparse+dense (BM25 + semantic). Upstash does not. For industries where exact keyword recall matters — legal (statute numbers), medical (drug codes), technical (error codes) — hybrid retrieval significantly improves precision. This is a functional gap, not just a performance gap.

---

### Weaviate

|                          |                                                                         |
| ------------------------ | ----------------------------------------------------------------------- |
| **Best for**             | Self-hosted, regulated industries, data residency requirements          |
| **Pricing model**        | Open-source (self-hosted free) or Weaviate Cloud (managed, usage-based) |
| **Consistency**          | Strong (RAFT consensus in cluster mode)                                 |
| **Namespacing**          | Multi-tenancy built in — native tenant isolation per class              |
| **Max index size**       | Production-grade, horizontal sharding                                   |
| **Operational overhead** | High if self-hosted — Kubernetes, persistent storage, backup strategy   |

**Why it wins in regulated industries:** GDPR right-to-erasure is simple — delete a tenant and every vector for that tenant is gone. With Upstash or Pinecone, you must track every vector key ever written for a user and delete them individually. Weaviate's tenant isolation makes this a single API call.

**Hidden cost:** self-hosting Weaviate on Kubernetes requires persistent volumes (EBS on AWS), a minimum of 3 nodes for HA, and an ops team to manage upgrades. Total cost of ownership is much higher than managed alternatives, even though the software is free.

---

### pgvector (Postgres extension)

|                          |                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Best for**             | Teams already on Postgres (Supabase), small-to-medium corpus, tight integration with relational data |
| **Pricing model**        | Part of your existing Postgres instance                                                              |
| **Consistency**          | ACID — no eventual consistency issues                                                                |
| **Namespacing**          | Row-level via `user_id` or `job_id` columns + RLS                                                    |
| **Max index size**       | Practical limit ~5M vectors before HNSW index rebuild times become painful                           |
| **Operational overhead** | Zero additional infrastructure                                                                       |

**The Supabase play:** Supabase supports pgvector natively. If you are already on Supabase, you can store vectors in the same database as your jobs table, with the same RLS policies, the same backups, and no additional service. For a solo developer or small team, this eliminates an entire service dependency.

**Why it fails at scale:** HNSW index in pgvector is an in-memory structure. At 10M vectors (each 1536 floats = 6KB), the index requires ~60GB RAM. Postgres on the free tier has 512MB RAM. Even on pro plans, pgvector is not designed for the index sizes that Pinecone or Weaviate handle natively.

**The hybrid architecture:** use pgvector for the RAG working set (recent documents, active jobs) and archive old vectors to Pinecone or cold storage. Most retrieval is against recent documents; old vectors are rarely queried. This is the split that makes pgvector viable at medium scale.

---

### Comparison Table

|                     | Upstash Vector | Pinecone (serverless) | Pinecone (pod) | Weaviate (managed) | pgvector      |
| ------------------- | -------------- | --------------------- | -------------- | ------------------ | ------------- |
| **Consistency**     | Eventual       | Eventual              | Strong         | Strong             | ACID          |
| **Hybrid search**   | No             | Yes                   | Yes            | Yes                | Extension     |
| **Multi-tenancy**   | Namespace      | Namespace             | Namespace      | Native tenant      | RLS           |
| **Scale ceiling**   | Medium         | Unlimited             | Unlimited      | Unlimited          | ~5M vectors   |
| **GDPR erasure**    | Manual         | Manual                | Manual         | Single call        | DELETE WHERE  |
| **Cost model**      | Per-op         | Per-unit              | Per-pod        | Per-unit           | Postgres cost |
| **Self-hosted**     | No             | No                    | No             | Yes                | Yes           |
| **Minimum monthly** | $0             | $0                    | ~$70           | ~$25               | $0            |

---

## 4. Orchestration at Scale — LangGraph Trade-offs

### What LangGraph gives you

- Stateful graph execution with typed state (not just a chain of prompts)
- Parallel node execution (DocumentAgent || VisionAgent || AudioAgent runs concurrently)
- Conditional edges (skip AudioAgent if no audio uploaded)
- Built-in checkpointing via a pluggable `CheckpointSaver` (Spectra uses Redis)
- LangSmith native integration for trace-level observability

### What breaks at scale

**State object bloat** — LangGraph state is passed between every node. If each node appends its full LLM output (500 tokens × 3 modalities = 1,500 tokens of state), by the time you reach SynthesisAgent the state object is large. This slows serialisation to Redis, increases checkpoint size, and increases token consumption if state is injected into subsequent prompts verbatim. Solution: nodes should write structured outputs (findings, confidence, citations) not raw LLM text.

**Retry semantics and idempotency** — LangGraph can resume from the last successful checkpoint on retry. But only if your nodes are idempotent. `visionNode` calls GPT-4o with the image. On retry, it calls it again — you pay twice, get two slightly different outputs, and the second overwrites the first. Make every node check: "have I already written my output for this jobId?" before executing. This is the checkpoint's purpose — but only if you actually read it before re-executing.

**Fan-out rate limits** — three parallel LLM calls in one Lambda invocation means three simultaneous API calls to Anthropic + OpenAI. All three share the same rate limit quotas. At 50 concurrent jobs, that is 150 concurrent LLM calls. OpenAI's rate limit is per-organisation, not per-request. A single traffic spike can throttle your entire user base simultaneously. Solution: a semaphore or queue in front of LLM calls, or separate API keys per modality with separate organisation accounts.

**Graph complexity ceiling** — beyond 8–10 nodes, LangGraph graphs become hard to reason about. Edge conditions multiply. A conditional edge that was correct at 3 nodes becomes incorrect when a new node adds a new state field. Tests that cover individual nodes do not cover graph-level emergence. Always test the full graph end-to-end with representative inputs, not just unit tests on nodes.

---

## 5. Checkpointing — The Persistence Layer

Checkpoints are the mechanism that makes long-running agent pipelines resumable. Without them, a Lambda timeout or a network blip means starting from scratch — paying for all LLM calls twice and potentially writing duplicate data.

### Redis-backed checkpoints (Spectra)

**What gets checkpointed:** the full LangGraph state after each node completes. In Spectra: RouterOutput → DocumentOutput → VisionOutput → AudioOutput → SynthesisOutput → AuditorOutput.

**What can go wrong:**

| Failure              | Symptom                            | Root cause                                                   |
| -------------------- | ---------------------------------- | ------------------------------------------------------------ |
| TTL expiry           | Job restarts from scratch on retry | Checkpoint key expired before retry window                   |
| Eviction             | Job loses mid-state                | Redis memory cap hit, LRU eviction removed the key           |
| Race condition       | Corrupted state                    | Two Lambda instances both retrying, both writing to same key |
| Oversized checkpoint | Slow serialisation                 | Node appending full LLM output instead of structured extract |
| No TTL set           | Unbounded Redis storage growth     | Checkpoint keys accumulate forever                           |

**Right pattern:** set TTL = max job lifetime + retry window (e.g. 2h for a job with 15-min Lambda timeout and 3 retries). Use atomic write (`SET NX` or conditional put) to prevent race condition writes. Write structured state, not raw LLM output.

### Postgres-backed checkpoints (alternative)

For regulated industries (financial, medical), checkpoints stored in Redis are transient — not auditable, not exportable, not subject to your data retention policies. Storing checkpoints in Postgres (either directly or via LangGraph's Postgres `CheckpointSaver`) makes them first-class records: queryable, exportable, covered by RLS and backup policies. Cost: higher write latency per checkpoint, heavier connection pool usage, larger tables.

### S3-backed checkpoints (large state)

If your checkpoint includes large artifacts (e.g., a processed image buffer, a full transcript), Redis is the wrong store — you are paying per byte in memory. Store large artifacts in S3, write only the S3 key into the Redis checkpoint. Checkpoint lookup becomes a two-step: Redis for metadata, S3 for payload. Adds latency but reduces Redis cost by orders of magnitude for media-heavy pipelines.

---

## 6. Model Routing at Scale

### The core principle

Not every task needs the most capable model. Routing tasks to the cheapest model that can complete them correctly is the primary cost-control lever in production AI systems.

### Spectra's routing map (and why)

| Node      | Model                   | Cost/1K tokens       | Why this model                                                         |
| --------- | ----------------------- | -------------------- | ---------------------------------------------------------------------- |
| Router    | Nova Micro (Bedrock)    | ~$0.000035           | Classification only — 5 labels, no generation                          |
| Document  | Claude Sonnet           | ~$0.003              | Grounded citation extraction — requires strong instruction following   |
| Vision    | GPT-4o                  | ~$0.005              | Native image understanding — no other model matches at this task       |
| Audio     | Whisper → Claude Sonnet | ~$0.006/min + $0.003 | Whisper is cheapest accurate transcription; Sonnet for extraction      |
| Synthesis | GPT-4o                  | ~$0.005              | Multi-source merge + conflict resolution — GPT-4o stronger here        |
| Auditor   | Claude Sonnet           | ~$0.003              | Faithfulness scoring — Sonnet's analytical strength, cheaper than Opus |

### Cost at scale — illustrative

1,000 jobs/month, each with a 10-page PDF (3,000 tokens) + image + 60s audio:

| Node      | Tokens/job                 | Cost/job        | Cost/1K jobs |
| --------- | -------------------------- | --------------- | ------------ |
| Router    | 200 in + 10 out            | $0.000007       | $0.007       |
| Document  | 3,500 in + 500 out         | ~$0.012         | $12          |
| Vision    | image + 500 out            | ~$0.008         | $8           |
| Audio     | 60s Whisper + 1,500 Sonnet | ~$0.010         | $10          |
| Synthesis | 5,000 in + 800 out         | ~$0.029         | $29          |
| Auditor   | 6,000 in + 200 out         | ~$0.019         | $19          |
| **Total** |                            | **~$0.078/job** | **~$78**     |

At 10,000 jobs/month: **~$780 in LLM API costs alone**, before infrastructure. This is where routing discipline pays off. A naive implementation that sends everything to GPT-4o Turbo (≈$0.015/1K tokens) at the same volume = ~$2,300/month. Model routing is not premature optimisation at this scale — it is the difference between a profitable product and one that loses money per user.

### Semantic gating (not yet built in Spectra)

Before any specialist LLM call, run the input through a cheap classifier (Nova Micro or a fine-tuned small model) that scores relevance to the task domain. If relevance < threshold, skip the specialist call entirely or return a canned "not applicable" response. For a document-heavy product where 20–30% of uploaded files are spam, wrong format, or clearly off-domain, semantic gating eliminates 20–30% of all downstream LLM costs with a $0.000035 gate.

**Implementation:**

```
documentNode:
  1. Nova Micro: "Is this text a meaningful document in a relevant domain? yes/no + confidence"
  2. If confidence < 0.7 → return early with reason "document not relevant to analysis domain"
  3. If confidence >= 0.7 → proceed to Claude Sonnet RAG pipeline
```

**Trade-off:** you are adding a classification call that itself can fail or return false negatives. A legitimate document that Nova Micro mislabels as irrelevant is silently dropped. Always log gate decisions and expose them in the governance trace so users can debug unexpected rejections.

---

## 7. Governance at Scale

Governance is the hardest axis to retrofit. Build it in from the start or you will spend 3x the engineering time adding it later under compliance pressure.

### The NIST AI RMF applied to production

The four functions (GOVERN → MAP → MEASURE → MANAGE) translate to concrete engineering requirements:

**GOVERN — Who is accountable, and what are the policies?**

- Every model call must be traceable to a job → user → organisation
- Model selection decisions must be logged (which model, which version, why)
- Access control must be enforced at the data layer, not just the API layer (RLS, not just JWT checks)
- Spectra implementation: `governance_trace` jsonb column in `jobs` table; LangSmith traces per job; JWT + RLS

**MAP — What can go wrong, and where?**

- Every node must declare its failure modes in a schema comment or companion test
- PII surfaces must be mapped per modality (Spectra: 3 text-producing nodes, each with explicit redaction)
- Third-party model dependencies must be named with fallback behaviour documented
- Spectra implementation: HARDENING_ROADMAP.md as the live threat model; red-team suite as evidence

**MEASURE — Are controls working?**

- Auditor scores (faithfulness, hallucination rate) must be stored, not discarded
- PII detection must be tested on every deploy, not just once
- Injection detection patterns must be versioned (adding a pattern is a breaking change to existing behaviour)
- Spectra implementation: red-team suite (75 tests), Auditor scores in `confidence_scores` jsonb

**MANAGE — How do you respond when something goes wrong?**

- Lambda errors must trigger CloudWatch alarms → SNS → on-call notification
- Failed jobs must write structured error messages to `jobs.error`, not just "unknown error"
- Retry logic must be bounded (Inngest maxRetries) — unbounded retry is a billing attack surface
- PII exposure incidents must be detectable from logs without reading the actual PII

### Audit trail design at scale

A common mistake: storing governance data as free-form text. At scale you need to query it.

```
governance_trace: [
  { timestamp, agent, finding, confidence, nistTag }
]
```

This is the right structure. At 100,000 jobs, you will want:

- "Show me all jobs where Document agent confidence < 0.5"
- "Show me all jobs where PII was redacted"
- "Show me all jobs where injection was detected"

For these queries to be fast, index the jsonb or extract key fields to dedicated columns. For regulated industries (healthcare, finance), these queries are not optional — they are compliance audit responses that must be answered within hours, not days.

### Data residency and sovereignty

At scale, regulated industries require data to stay within a geographic boundary:

| Industry        | Regulation     | Requirement                                                              |
| --------------- | -------------- | ------------------------------------------------------------------------ |
| Healthcare (EU) | GDPR + HIPAA   | PHI must not leave EU/US respectively                                    |
| Finance (UK)    | FCA, PRA       | Data localisation for client records                                     |
| Government      | FedRAMP / NCSC | US/UK government-approved regions only                                   |
| Legal           | GDPR           | Client-attorney privilege — no third-party AI processing without consent |

**Stack implications:**

- OpenAI API: data processed in US (OpenAI's infrastructure). For EU-only data, this is a GDPR issue unless you have a DPA and explicit user consent.
- Anthropic API: same — data leaves your infrastructure.
- AWS Bedrock: runs within your AWS region, never leaves it. This is why Nova Micro on Bedrock is the correct architecture for regulated routing — classification happens in-region.
- Self-hosted models (Llama, Mistral via AWS Bedrock or your own GPU): full data residency, no third-party exposure. Required for air-gapped or sovereign deployments.

**The governance trade-off:** GPT-4o is the best model for multimodal analysis. In a GDPR-strict context, you may not be able to use it. You choose between capability and compliance. For healthcare startups, this decision is often: use a weaker model in-region, or get explicit user consent for third-party processing. Neither is obviously correct — name the trade-off explicitly.

---

## 8. Multi-Tenancy at Scale

Multi-tenancy is where most AI startups have an incident. The failure mode is always the same: data from one tenant is visible to or contaminates another.

### Vector store isolation

**Namespace-level isolation (Spectra, Pinecone, Upstash):** all vectors for a tenant share a namespace. Fast, cheap, but: a bug in the namespace key generation can cause namespace collision. One user's document chunks end up in another user's retrieval results. Silent — the retrieval still returns top-k vectors, just the wrong ones.

**Index-level isolation:** each tenant gets a dedicated index. No possible cross-contamination. Cost: one index per tenant × index fixed cost. At 10,000 tenants, this becomes prohibitive on Pinecone pod-based pricing.

**Row-level isolation (pgvector + RLS):** every vector row has a `user_id` foreign key. RLS ensures queries only return rows matching the authenticated user. Most operationally correct approach. Performance limit: at 5M+ vectors, index scans across `user_id` partitions slow down.

**Right pattern at scale:** namespace-level isolation with cryptographic key derivation for namespace names. `namespace = HMAC(userId + salt)` — even if the code has a bug that exposes namespace keys in logs, they are not guessable user IDs. Rotate the salt periodically.

### Rate limiting

Flat rate limits (Spectra: 3 jobs/day/IP) break at scale when you have enterprise customers with 100 users behind a single corporate IP. You need:

- **Per-user rate limit** (not per-IP) once you have auth
- **Per-tenant rate limit** for enterprise accounts
- **Burst vs sustained limits** — allow 10 jobs in 5 minutes, but cap at 50/day

Upstash Ratelimit supports sliding window and fixed window. For fairness across tenants, sliding window is correct — a fixed window resets at midnight, so a user can do 3 jobs at 11:59pm and 3 more at 12:00am.

### Authentication token scoping

JWTs should carry the minimum claims needed. Spectra's JWTs carry `userId` and `role`. At scale:

- Add `tenantId` when you have organisations
- Add `permissions` array when you have feature gating (e.g., audio modality is enterprise-only)
- Never put job IDs, file paths, or model preferences in the JWT — these are mutable state, not identity claims

---

## 9. Industry-Specific Architecture Patterns

### Healthcare / Medical Records

**Pipeline topology:** patient documents (PDF lab reports, discharge summaries) → DocumentAgent (RAG) → VisionAgent (X-ray, MRI images) → AudioAgent (physician dictation) → SynthesisAgent → AuditorAgent

**Critical requirements:**

- PII coverage must include DOB, patient name, MRN (medical record number), diagnosis codes (ICD-10), provider NPI
- PHI must never leave the deployment region (AWS Bedrock for routing and classification, self-hosted or Bedrock-hosted models for text extraction if possible)
- Audit trail must be append-only — no updates to `governance_trace` after write
- Confidence scores below threshold must trigger human review queue — not automatic action
- Right to erasure: delete job + delete all vectors for that job_id + delete checkpoints

**Stack recommendation:** Weaviate (multi-tenant native erasure) over Upstash/Pinecone. Bedrock over OpenAI where data residency applies. pgvector as secondary for metadata search.

---

### Legal / Contract Analysis

**Pipeline topology:** contract PDF → DocumentAgent (clause extraction, obligation mapping) → SynthesisAgent (conflict detection between clauses) → AuditorAgent (citation verification)

**Critical requirements:**

- Exact keyword retrieval as important as semantic retrieval — statute numbers, clause references (§ 12.3(a)), party names must be recalled precisely
- Hybrid search (BM25 + dense) is not optional — Pinecone or Weaviate, not Upstash
- Hallucination rate must be near-zero — a synthesis that invents a clause obligation is a liability
- Audit trail must map every finding to a source chunk with byte offset (not just chunk index)
- Client data must not be used for model training — need a DPA with zero retention from OpenAI/Anthropic

**Stack recommendation:** Pinecone with sparse+dense hybrid. Claude Sonnet for extraction (stronger citation adherence than GPT-4o). GPT-4o as synthesis model only — not for extraction. Auditor pass/fail threshold higher than default.

---

### Financial Services / Regulatory Reporting

**Pipeline topology:** earnings report PDFs + spreadsheet data → DocumentAgent (financial statement extraction) → SynthesisAgent (cross-document comparison) → AuditorAgent (regulatory flag detection)

**Critical requirements:**

- Numeric accuracy is the primary failure mode — LLMs hallucinate numbers more than text
- All numeric claims in synthesis output must trace to a source chunk with confidence score
- Regulatory tags (NIST, SEC Rule references) must be present on every finding
- No synthesis output should be acted on without human review — the system is analytical, not decisional
- SOC2 compliance for multi-tenant data storage

**Stack recommendation:** pgvector for numeric data (ACID consistency, no eventual consistency risk on financial figures). LLM-as-Judge Auditor with numeric extraction verification pass (check that every number in the synthesis appears verbatim in at least one source chunk).

---

### Cybersecurity / Threat Intelligence

**Pipeline topology:** incident reports, CVE descriptions, network logs → DocumentAgent (IOC extraction) → SynthesisAgent (threat pattern correlation) → AuditorAgent (confidence scoring)

**Critical requirements:**

- Low-latency retrieval — a security analyst waiting 2 minutes for threat context is too slow. p99 < 30s target.
- The document corpus updates in real-time — new CVEs, new threat actor reports. Upstash Vector's ingestion latency matters.
- Injection attacks in malicious documents are a real threat, not a theoretical one — the documents being analysed are themselves adversarial
- Air-gapped deployments for government/defence — no outbound API calls to OpenAI/Anthropic

**Stack recommendation:** Weaviate self-hosted (air-gap capable). Bedrock models only (Nova, Claude on Bedrock) for air-gapped deployments. The semantic gate on document ingestion is security-critical here — filter out documents that trigger injection patterns before they reach the agent graph.

---

### Media & Publishing / Content Intelligence

**Pipeline topology:** news articles, transcripts, audio clips → DocumentAgent + AudioAgent (parallel) → VisionAgent (image analysis) → SynthesisAgent (content summary + entity extraction) → AuditorAgent

**Critical requirements:**

- High throughput — breaking news may require processing 500 documents/hour
- Low precision requirement — getting 90% of the story right quickly beats 99% slowly
- Cost is primary constraint — media economics are thin-margin
- Async is required — no user is waiting for a single document

**Stack recommendation:** Upstash (cost-effective at medium volume, acceptable eventual consistency). Nova Micro for as much as possible — demote Claude Sonnet to Synthesis only. Aggressive semantic gating to avoid processing irrelevant documents. Lambda scaling for burst capacity on breaking news events.

---

## 10. Edge Cases at Scale

These are the cases that do not appear in happy-path testing but cause production incidents.

**The 400-page PDF** — most PDF parsers chunk by page. A 400-page document generates 400 chunks. Upserting 400 vectors in a single Lambda invocation takes ~20s. The RAG retrieval for top-k=5 becomes meaningless — you need a two-stage retrieval (coarse → fine). Max document size must be enforced at the API boundary before ingestion.

**The silent empty transcript** — Whisper returns an empty string for a silent audio file (background noise only). `audioNode` proceeds with an empty transcript, generates an empty finding set, and the job completes with a confidence score of 0. No error is thrown. The user sees a completed job with no audio findings and no explanation. Minimum content validation on the transcript (like the vision node's 20-character check) prevents this.

**The inconsistent synthesis** — three modalities agree on facts A and B. They disagree on fact C. SynthesisAgent picks one version. The AuditorAgent scores C as low confidence. The synthesis report presents C as a finding with a low-confidence label. The user sees it and acts on it. At scale, how often does this happen? You need a metric: "jobs where at least one finding has confidence < 0.5 / total jobs." If it is above 5%, your synthesis prompt needs work.

**Token budget exhaustion mid-chain** — a 50-page document hits DocumentAgent. After chunking and RAG retrieval, the context window is 90% full. The Claude Sonnet prompt is assembled: system prompt + retrieved chunks + task instructions. Total = 195,000 tokens. Claude Sonnet's context window is 200K. You are 5K tokens from the limit. On the next retry (slightly different chunking), you overflow. No error — just a silent truncation that changes the output. You need a token budget guard before prompt assembly.

**The rate-limit cascade** — 50 jobs arrive simultaneously. All 50 trigger DocumentAgent. All 50 call Claude Sonnet within seconds of each other. You hit Anthropic's TPM limit. All 50 get 429 responses. All 50 Lambdas throw errors. Inngest retries all 50 simultaneously in 30 seconds. You hit the rate limit again. This loop repeats until the jobs hit their max retry count and all fail. Solution: exponential backoff with jitter on the retry, not a fixed retry interval.

**The stale model version** — you pin `gpt-4o-2024-08-06`. Six months later, OpenAI deprecates it. The model endpoint returns 404. Your Lambda throws an unhandled error. Every job fails. You have no alert on model-specific 404s, only on generic Lambda errors. Solution: model version as a config variable (not hardcoded), CloudWatch alarm on sustained 4xx rates from LLM API calls, and a monthly "model deprecation check" in your ops calendar.

**The persona leak across sessions** — a user submits a document, the job runs, vectors are stored under `{jobId}/{userId}/`. Job completes. Cleanup runs and deletes the vectors. A second job from the same user runs 5 minutes later. A poorly-written cleanup leaves some vectors from job 1 behind (partial delete due to timeout). Job 2's RAG retrieval picks up chunks from job 1. The synthesis combines findings from two different documents. Silent cross-job contamination. Solution: verify vector deletion with a post-delete query before marking cleanup complete.

**The governance trace write failure** — job completes successfully. The `governance_trace` jsonb update to Supabase fails (connection timeout). The job status is `completed` but the governance trace is empty or stale. From an audit perspective, this job has no provenance. Solution: write `governance_trace` in the same transaction as `status = 'completed'`, not as a separate follow-up write. If the governance write fails, the job is not complete.

---

_Reference: see TECHNICAL_ADVISORY.md §14 for semantic gating analysis, §25 for video modality architecture, and HARDENING_ROADMAP.md for open work items. For per-node guardrail pipeline flows, see ARCHITECTURE_FLOWS.md §13._
