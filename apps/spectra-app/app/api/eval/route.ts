import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const EvalRequestSchema = z.object({
  input: z.string().min(1).max(8000),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function checkApiKey(request: NextRequest): boolean {
  const requiredKey = process.env.EVAL_API_KEY;
  if (!requiredKey) return true;
  return request.headers.get("x-eval-api-key") === requiredKey;
}

export async function POST(request: NextRequest) {
  if (!checkApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "BAD_REQUEST" }, { status: 400 });
  }

  const parsed = EvalRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", code: "BAD_REQUEST", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { input } = parsed.data;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `<document>
${input}
</document>

Analyse the document above. Extract the key findings as a concise structured summary. Focus on factual statements, quantities, and relationships present in the text. Do not fabricate information not in the document.

Respond with a single plain-text summary (no JSON, no markdown headers). 2–5 sentences maximum.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json(
      { error: "Unexpected model response", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }

  return NextResponse.json({ output: content.text.trim() });
}
