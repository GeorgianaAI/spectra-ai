import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { downloadFromS3 } from "../../lib/s3-client";
import { detectPromptInjection } from "../../lib/prompt-injection";
import { AudioInputSchema, AudioOutputSchema, type AudioOutput } from "../../lib/schemas";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_WHISPER_API_KEY ?? process.env.OPENAI_API_KEY,
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXT_TO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  webm: "audio/webm",
  m4a: "audio/mp4",
};

export async function audioNode(
  state: Record<string, unknown>,
): Promise<{ audioOutput: AudioOutput }> {
  const input = AudioInputSchema.parse(state);

  const audioBuffer = await downloadFromS3(input.s3Key);

  const ext = input.s3Key.split(".").pop()?.toLowerCase() ?? "mp3";
  const filename = `audio.${ext}`;
  const mimeType = EXT_TO_MIME[ext] ?? "audio/mpeg";

  // Whisper transcription — convert Buffer to File for the OpenAI SDK
  const audioFile = new File([new Uint8Array(audioBuffer)], filename, { type: mimeType });
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    response_format: "verbose_json",
  });

  const transcript = transcription.text;
  const durationSeconds = (transcription as unknown as { duration?: number }).duration ?? 0;

  const injectionCheck = detectPromptInjection(transcript);
  if (!injectionCheck.safe) {
    throw new Error(`Audio transcript rejected: ${injectionCheck.reason}`);
  }

  // Claude Sonnet extracts structured findings from the transcript
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `<transcript>
${transcript}
</transcript>

Extract structured intelligence findings from this audio transcript.

Respond with ONLY a JSON object:
{
  "findings": ["Key factual statements, decisions, or intelligence from the spoken content"]
}

Focus on: named entities, decisions made, dates/times mentioned, locations, technical terms, and any actionable intelligence.`,
      },
    ],
  });

  let findings: string[];
  try {
    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected content type");
    const cleaned = content.text.trim().replace(/^```json\n?|```$/g, "");
    const parsed = JSON.parse(cleaned) as { findings: string[] };
    findings = parsed.findings;
  } catch {
    findings = ["Audio transcribed — structured extraction unavailable"];
  }

  const output = AudioOutputSchema.parse({ transcript, findings, durationSeconds });
  return { audioOutput: output };
}
