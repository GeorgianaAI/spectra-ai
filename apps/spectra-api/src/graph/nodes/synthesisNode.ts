import OpenAI from "openai";
import {
  SynthesisInputSchema,
  SynthesisOutputSchema,
  type SynthesisOutput,
} from "../../lib/schemas";
import { validateSynthesisReport } from "../../lib/synthesis-guardrails";
import type { SpectraState } from "../state";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function synthesisNode(
  state: SpectraState,
): Promise<{ synthesisOutput: SynthesisOutput }> {
  const input = SynthesisInputSchema.parse({
    jobId: state.jobId,
    documentOutput: state.documentOutput,
    visionOutput: state.visionOutput,
    audioOutput: state.audioOutput,
    activeModalities: state.activeModalities,
  });

  const sections: string[] = [];

  if (input.documentOutput) {
    sections.push(`<document_findings>
${input.documentOutput.findings.map((f, i) => `[D${i + 1}] ${f}`).join("\n")}
Citations: ${input.documentOutput.citations.map((c) => `${c.id}: ${c.chunk.slice(0, 100)}`).join(" | ")}
</document_findings>`);
  }

  if (input.visionOutput) {
    sections.push(`<vision_findings>
${input.visionOutput.findings.map((f, i) => `[V${i + 1}] ${f}`).join("\n")}
Annotations: ${input.visionOutput.annotations.map((a) => `${a.label} (${(a.confidence * 100).toFixed(0)}%)`).join(", ")}
</vision_findings>`);
  }

  if (input.audioOutput) {
    sections.push(`<audio_findings>
Transcript (excerpt): ${input.audioOutput.transcript.slice(0, 500)}
${input.audioOutput.findings.map((f, i) => `[A${i + 1}] ${f}`).join("\n")}
</audio_findings>`);
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: `You are a senior intelligence analyst synthesising findings from multiple modalities into a single grounded report.
Tag every claim with its modality source: [D1] for document, [V1] for vision, [A1] for audio.
Flag contradictions between modalities as [CONFLICT: D1 vs V2].
Be precise, evidence-based, and cite every claim.`,
      },
      {
        role: "user",
        content: `${sections.join("\n\n")}

Active modalities: ${input.activeModalities.join(", ")}

Produce a unified intelligence report that:
1. Merges findings from all active modalities with inline citation tags
2. Flags any contradictions between modalities
3. Maintains a neutral, analytical tone

Then respond with ONLY a JSON object:
{
  "report": "Full markdown report with [D1], [V1], [A1] tags and [CONFLICT: X vs Y] flags",
  "citations": [{ "id": "string", "modality": "document|vision|audio", "source": "brief description" }],
  "conflicts": [{ "description": "string", "modalitiesInvolved": ["string"] }]
}`,
      },
    ],
  });

  let parsedResult: SynthesisOutput;
  try {
    const text = response.choices[0]?.message?.content ?? "";
    const cleaned = text.trim().replace(/^```json\n?|```$/g, "");
    parsedResult = SynthesisOutputSchema.parse(JSON.parse(cleaned));
  } catch {
    parsedResult = SynthesisOutputSchema.parse({
      report: response.choices[0]?.message?.content ?? "Synthesis complete",
      citations: [],
      conflicts: [],
    });
  }

  validateSynthesisReport(parsedResult.report, input.activeModalities);

  return { synthesisOutput: parsedResult };
}
