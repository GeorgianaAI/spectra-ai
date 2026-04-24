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
    parser.on("pdfParser_dataError", (err: unknown) => reject(err));
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

const EMPTY_OUTPUT: DocumentOutput = {
  findings: ["Document contained no extractable text — PDF may be image-based or empty."],
  citations: [],
  redactedFields: [],
};

export async function documentNode(
  state: Record<string, unknown>,
): Promise<{ documentOutput: DocumentOutput }> {
  const input = DocumentInputSchema.parse(state);
  // Use a per-job namespace so dedup and retrieval are isolated to this job only.
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

  // Embed and deduplicate within this job's namespace only.
  const DEDUP_THRESHOLD = 0.97;
  const upsertPayload: Array<{ id: string; vector: number[]; metadata: Record<string, unknown> }> = [];

  for (let i = 0; i < Math.min(chunks.length, 50); i++) {
    const embedding = await embedText(chunks[i]);

    if (upsertPayload.length > 0) {
      // Query only within this job's namespace — no cross-job deduplication.
      const nearest = await ns.query({
        vector: embedding,
        topK: 1,
        includeMetadata: false,
      });
      if (nearest[0]?.score != null && nearest[0].score >= DEDUP_THRESHOLD) {
        continue;
      }
    }

    upsertPayload.push({
      id: `${i}`,
      vector: embedding,
      metadata: { chunk: chunks[i], jobId: input.jobId, index: i },
    });
  }

  if (upsertPayload.length > 0) {
    await ns.upsert(upsertPayload);
  }

  // Retrieve top-5 relevant chunks scoped to this job's namespace.
  const queryEmbedding = await embedText(redactedText.slice(0, 1000));
  const results = await ns.query({
    vector: queryEmbedding,
    topK: 5,
    includeMetadata: true,
  });

  if (results.length === 0) {
    console.warn(`[documentNode] Vector retrieval returned no results for job ${input.jobId}`);
    return { documentOutput: { ...EMPTY_OUTPUT, redactedFields } };
  }

  const topChunks = results
    .filter((r) => r.metadata != null && typeof (r.metadata as Record<string, unknown>)["chunk"] === "string")
    .map((r, i) => ({
      id: `D${i + 1}`,
      chunk: (r.metadata as { chunk: string }).chunk,
      relevanceScore: r.score ?? 0,
    }));

  if (topChunks.length === 0) {
    console.warn(`[documentNode] All retrieved vectors lacked chunk metadata for job ${input.jobId}`);
    return { documentOutput: { ...EMPTY_OUTPUT, redactedFields } };
  }

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
