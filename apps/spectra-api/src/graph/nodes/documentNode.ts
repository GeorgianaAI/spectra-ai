import Anthropic from "@anthropic-ai/sdk";
import { Index } from "@upstash/vector";
import OpenAI from "openai";
import PDFParser from "pdf2json";
import { downloadFromS3 } from "../../lib/s3-client";
import { redactPii } from "../../lib/pii-redaction";
import { DocumentInputSchema, DocumentOutputSchema, type DocumentOutput } from "../../lib/schemas";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getVectorIndex(): Index {
  return new Index({
    url: process.env.UPSTASH_VECTOR_URL ?? "",
    token: process.env.UPSTASH_VECTOR_TOKEN ?? "",
  });
}

async function parsePdf(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true);
    parser.on("pdfParser_dataReady", (data) => {
      const dataUnknown = data as unknown as Record<string, unknown>;
      try {
        const pages = dataUnknown["Pages"] as Array<{ Texts: Array<{ R: Array<{ T: string }> }> }>;
        const text = pages
          .flatMap((page) => page.Texts)
          .flatMap((t) => t.R)
          .map((r) => decodeURIComponent(r.T))
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

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
    i += chunkSize - overlap;
  }
  return chunks.filter((c) => c.trim().length > 0);
}

async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

export async function documentNode(
  state: Record<string, unknown>,
): Promise<{ documentOutput: DocumentOutput }> {
  const input = DocumentInputSchema.parse(state);
  const namespace = `${input.jobId}/${input.userId}`;
  const index = getVectorIndex();

  const rawBuffer = await downloadFromS3(input.s3Key);
  const rawText = await parsePdf(rawBuffer);
  const { text: redactedText, redactedFields } = redactPii(rawText);

  const chunks = chunkText(redactedText);

  // Embed and store chunks in Upstash Vector under session namespace
  const upsertPayload = await Promise.all(
    chunks.slice(0, 50).map(async (chunk, i) => {
      const embedding = await embedText(chunk);
      return {
        id: `${namespace}/${i}`,
        vector: embedding,
        metadata: { chunk, jobId: input.jobId, index: i },
      };
    }),
  );
  await index.upsert(upsertPayload);

  // Retrieve top-5 relevant chunks using the full document as query
  const queryEmbedding = await embedText(redactedText.slice(0, 1000));
  const results = await index.query({
    vector: queryEmbedding,
    topK: 5,
    includeMetadata: true,
  });

  const topChunks = results.map((r, i) => ({
    id: `D${i + 1}`,
    chunk: (r.metadata as { chunk: string }).chunk,
    relevanceScore: r.score,
  }));

  // Claude Sonnet extracts structured findings and citations
  const citationContext = topChunks.map((c) => `[${c.id}] ${c.chunk}`).join("\n\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
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
