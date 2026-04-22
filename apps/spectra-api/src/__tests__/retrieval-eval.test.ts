/**
 * Retrieval Evaluation Harness
 *
 * Golden-set tests that verify the chunk pipeline (quality filter +
 * deduplication) produces the expected output for known inputs. These
 * tests run entirely in-process — no Upstash calls, no embeddings.
 *
 * To measure real retrieval precision, extend GOLDEN_SET with document +
 * query + expected_chunk triples and run against a seeded Upstash namespace
 * with RETRIEVAL_EVAL=true.
 */

import { describe, expect, it } from "vitest";

// ─── Re-export the private helpers under test ─────────────────────────────────
// We test the chunk pipeline logic directly by replicating the functions here.
// If documentNode's chunk logic changes, update these copies and the golden set.

const MIN_CHUNK_WORDS = 20;

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
    i += chunkSize - overlap;
  }
  return chunks.filter((c) => c.trim().split(/\s+/).length >= MIN_CHUNK_WORDS);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

// ─── Golden set ───────────────────────────────────────────────────────────────

const FINANCIAL_MEMO = `
The board approved the Q4 budget on December 1st. Revenue increased 12% year on year.
Three irregular transfers were identified in the British Virgin Islands entities.
The CFO authorised all transfers without dual-approval sign-off as required by policy.
Total transferred: $2.1 million across Cayman, BVI, and Isle of Man accounts.
The audit committee has requested a full forensic review of all inter-entity movements.
Supporting documentation including wire confirmations was not provided to the auditors.
External counsel engaged on January 15th to advise on disclosure obligations.
`.repeat(10);

const BOILERPLATE = "CONFIDENTIAL — FOR INTERNAL USE ONLY";

// ─── Chunk quality filter ─────────────────────────────────────────────────────

describe("chunkText — quality filtering", () => {
  it("filters out short fragments below MIN_CHUNK_WORDS", () => {
    const text = Array(5).fill(BOILERPLATE).join(" ");
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      expect(chunk.trim().split(/\s+/).length).toBeGreaterThanOrEqual(MIN_CHUNK_WORDS);
    }
  });

  it("preserves substantive document text", () => {
    const chunks = chunkText(FINANCIAL_MEMO);
    expect(chunks.length).toBeGreaterThan(0);
    const allText = chunks.join(" ").toLowerCase();
    expect(allText).toContain("budget");
    expect(allText).toContain("transfer");
  });

  it("produces overlapping chunks for continuity", () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(words, 500, 50);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Second chunk should start earlier than non-overlapping would
    const firstEnd = chunks[0].split(" ").slice(-10).join(" ");
    expect(chunks[1]).toContain(firstEnd.split(" ")[0]);
  });

  it("returns empty array for blank input", () => {
    expect(chunkText("")).toHaveLength(0);
  });

  it("returns empty array when all chunks are too short", () => {
    const tinyText = Array(3).fill("Hi there.").join(" ");
    expect(chunkText(tinyText)).toHaveLength(0);
  });
});

// ─── Deduplication (cosine similarity) ───────────────────────────────────────

describe("cosineSimilarity — deduplication gate", () => {
  it("identical vectors score 1.0", () => {
    const v = [0.1, 0.9, 0.3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it("orthogonal vectors score 0.0", () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
  });

  it("near-duplicate vectors exceed 0.97 threshold", () => {
    const base = [0.8, 0.6, 0.0];
    const nearDup = [0.81, 0.59, 0.01];
    expect(cosineSimilarity(base, nearDup)).toBeGreaterThan(0.97);
  });

  it("distinct vectors fall below 0.97 threshold", () => {
    const a = [1.0, 0.0, 0.0];
    const b = [0.5, 0.5, 0.7];
    expect(cosineSimilarity(a, b)).toBeLessThan(0.97);
  });

  it("handles zero vectors without throwing", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});

// ─── Golden set: end-to-end chunk pipeline ────────────────────────────────────

describe("chunk pipeline — golden set", () => {
  it("financial memo produces chunks containing expected signal terms", () => {
    const chunks = chunkText(FINANCIAL_MEMO);
    const allText = chunks.join(" ").toLowerCase();
    expect(allText).toContain("transfer");
    expect(allText).toContain("audit");
    expect(allText).toContain("cfo");
  });

  it("chunk count is within expected bounds for a medium document", () => {
    const chunks = chunkText(FINANCIAL_MEMO);
    // Financial memo ~100 words × 10 repeats = ~1,000 words → expect 2–5 chunks at 500-word size
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.length).toBeLessThan(10);
  });

  it("no chunk is all-whitespace after filtering", () => {
    const chunks = chunkText(FINANCIAL_MEMO);
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });
});
