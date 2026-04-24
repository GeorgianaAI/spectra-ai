import Anthropic from "@anthropic-ai/sdk";
import { Index } from "@upstash/vector";
import OpenAI from "openai";
import PDFParser from "pdf2json";
import { downloadFromS3 } from "../../lib/s3-client";
import { redactPii } from "../../lib/pii-redaction";
import { detectPromptInjection } from "../../lib/prompt-injection";
import { DocumentInputSchema, DocumentOutputSchema, type DocumentOutput } from "../../lib/schemas";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getVectorIndex(): Index {
  return new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL ?? "",
    token: process.env.UPSTASH_VECTOR_REST_TOKEN ?? "",
  });
}

// pdf2json encodes text as URI components but does not always produce valid
// percent-sequences (e.g. a bare "%" in "50% interest" → URIError). Fall back
// to the raw value so parsing never throws on financial/special characters.
function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

async function parsePdf(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true);
    parser.on("pdfParser_dataReady", (data) => {
      const dataUnknown = data as unknown as Record<string, unknown>;
      try {
        const pages = dataUnknown["Pages"] as Array<{ Texts: Array<{ R: Array<{ T: string }> }> }>;
        if (!pages || pages.length === 0) {
          resolve("");
          return;
        }
        const text = pages
          .flatMap((page) => page.Texts ?? [])
          .flatMap((t) => t.R ?? [])
          .map((r) => safeDecodeURIComponent(r.T))
          .join(" ");
        resolve(text);
      } catch (err) {
        reject(err);
      }
    });
    parser.on("pdfParser_dataError", (err: unknown) => {
      console.error("[parsePdf] pdfParser_dataError:", err);
      reject(err);
    });
    parser.parseBuffer(buffer);
  });
}

const MIN_CHUNK_WORDS = 20;

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) return [];

  // Keep very short documents as a single chunk rather than discarding them.
  if (words.length < MIN_CHUNK_WORDS) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
    i += chunkSize - overlap;
  }
  return chunks.filter((c) => c.trim().split(/\s+/).length >= MIN_CHUNK_WORDS);
}

async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

// Cosine similarity between two equal-length vectors.
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const EMPTY_OUTPUT: DocumentOutput = {
  findings: ["Document contained no extractable text — PDF may be image-based or empty."],
  citations: [],
  redactedFields: [],
};

export async function documentNode(
  state: Record<string, unknown>,
): Promise<{ documentOutput: DocumentOutput }> {
  const input = DocumentInputSchema.parse(state);
  const namespace = `${input.jobId}_${input.userId}`;
  const index = getVectorIndex();
  const ns = index.namespace(namespace);

  const rawBuffer = await downloadFromS3(input.s3Key);
  const rawText = await parsePdf(rawBuffer);

  if (!rawText.trim()) {
    console.warn(`[documentNode] PDF yielded no text for job ${input.jobId} — returning empty output`);
    return { documentOutput: EMPTY_OUTPUT };
  }

  const injectionCheck = detectPromptInjection(rawText);
  if (!injectionCheck.safe) {
    throw new Error(`Document rejected: ${injectionCheck.reason}`);
  }

  const { text: redactedText, redactedFields } = redactPii(rawText);

  const chunks = chunkText(redactedText);

  if (chunks.length === 0) {
    console.warn(`[documentNode] No chunks produced for job ${input.jobId}`);
    return { documentOutput: { ...EMPTY_OUTPUT, redactedFields } };
  }

  // Embed all chunks and keep vectors in memory for similarity scoring.
  // Upstash Vector has eventual consistency — querying immediately after upsert
  // returns 0 results. We compute retrieval in-memory and upsert for audit trail only.
  const embeddedChunks: Array<{ id: string; vector: number[]; chunk: string }> = [];
  for (let i = 0; i < Math.min(chunks.length, 50); i++) {
    const vector = await embedText(chunks[i]);
    embeddedChunks.push({ id: `${i}`, vector, chunk: chunks[i] });
  }

  // Upsert to vector store for audit trail (fire-and-forget — not on the critical path).
  ns.upsert(
    embeddedChunks.map((c) => ({
      id: c.id,
      vector: c.vector,
      metadata: { chunk: c.chunk, jobId: input.jobId },
    })),
  ).catch((err) => console.warn(`[documentNode] vector upsert failed (non-critical):`, err));

  // Select top-5 chunks by cosine similarity against the document head.
  const queryEmbedding = await embedText(redactedText.slice(0, 1000));
  const topChunks = embeddedChunks
    .map((c, i) => ({
      id: `D${i + 1}`,
      chunk: c.chunk,
      relevanceScore: cosineSimilarity(queryEmbedding, c.vector),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5);

  // Claude Sonnet extracts structured findings and citations.
  const citationContext = topChunks.map((c) => `[${c.id}] ${c.chunk}`).join("\n\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `<document_chunks>
${citationContext}
</document_chunks>

Analyse the document chunks above. Extract:
1. A list of key findings (factual statements directly supported by the text).
2. Citation references — for each chunk that contributed a finding, note its ID and a brief description.

Respond with ONLY a JSON object matching this shape:
{
  "findings": ["string"],
  "citations": [{ "id": "string", "chunk": "string", "relevanceScore": number }]
}`,
      },
    ],
  });

  let parsedResult: {
    findings: string[];
    citations: Array<{ id: string; chunk: string; relevanceScore: number }>;
  };
  try {
    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected content type");
    const cleaned = content.text.trim().replace(/^```json\n?|```$/g, "");
    parsedResult = JSON.parse(cleaned);
  } catch {
    parsedResult = {
      findings: ["Document processed — structured extraction unavailable"],
      citations: topChunks,
    };
  }

  const output = DocumentOutputSchema.parse({
    findings: parsedResult.findings,
    citations: parsedResult.citations.map((c) => ({ ...c, page: undefined })),
    redactedFields,
  });

  return { documentOutput: output };
}
