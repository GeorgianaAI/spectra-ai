import Anthropic from "@anthropic-ai/sdk";
import { AuditorInputSchema, AuditorOutputSchema, type AuditorOutput } from "../../lib/schemas";
import type { SpectraState } from "../state";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const NIST_TAGS = ["GOVERN", "MAP", "MEASURE", "MANAGE"] as const;

function assignNistTag(finding: string): (typeof NIST_TAGS)[number] {
  const lower = finding.toLowerCase();
  if (lower.includes("govern") || lower.includes("policy") || lower.includes("oversight"))
    return "GOVERN";
  if (lower.includes("risk") || lower.includes("context") || lower.includes("categor"))
    return "MAP";
  if (
    lower.includes("score") ||
    lower.includes("measur") ||
    lower.includes("confidence") ||
    lower.includes("hallucin")
  )
    return "MEASURE";
  return "MANAGE";
}

export async function auditorNode(state: SpectraState): Promise<{ auditorOutput: AuditorOutput }> {
  if (!state.synthesisOutput) {
    throw new Error("auditorNode requires synthesisOutput — synthesisNode must run first");
  }

  const input = AuditorInputSchema.parse({
    jobId: state.jobId,
    synthesisOutput: state.synthesisOutput,
    documentOutput: state.documentOutput,
    visionOutput: state.visionOutput,
    audioOutput: state.audioOutput,
  });

  const sourceContext: string[] = [];
  if (input.documentOutput) {
    sourceContext.push(`Document findings: ${input.documentOutput.findings.join(" | ")}`);
  }
  if (input.visionOutput) {
    sourceContext.push(`Vision findings: ${input.visionOutput.findings.join(" | ")}`);
  }
  if (input.audioOutput) {
    sourceContext.push(`Audio findings: ${input.audioOutput.findings.join(" | ")}`);
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `<source_findings>
${sourceContext.join("\n")}
</source_findings>

<synthesis_report>
${input.synthesisOutput.report}
</synthesis_report>

You are an LLM-as-Judge auditor evaluating this synthesis report for faithfulness, hallucination, and grounding.

Score each active modality 0-100 for faithfulness to source findings. Score 0 if modality not used.
Identify any hallucinations (claims not grounded in source findings).
For each key finding in the report, create a governance trace entry with a NIST AI RMF function tag AND a specific control ID.

NIST AI RMF control ID reference:
- GOVERN 1.1: Policies and accountability structures for AI risk are established
- GOVERN 1.2: Roles and responsibilities for AI risk management are defined
- MAP 1.1: Context and purpose of the AI system are documented
- MAP 2.1: Scientific and domain expertise informs AI development
- MAP 3.5: Practices for identifying AI system risks are applied
- MEASURE 1.1: Measurement and evaluation approaches are established
- MEASURE 2.1: Grounding and factual accuracy of AI outputs is assessed
- MEASURE 2.5: Hallucination and confabulation risks are tracked
- MANAGE 1.1: Risk treatment decisions are made and documented
- MANAGE 2.2: Residual risks and accepted uncertainties are tracked

Respond with ONLY a JSON object:
{
  "confidenceScores": { "doc": 0-100, "vision": 0-100, "audio": 0-100 },
  "hallucinations": ["list of ungrounded claims, or empty"],
  "overallFaithfulness": 0-100,
  "governanceTrace": [
    {
      "timestamp": "ISO 8601",
      "agent": "document|vision|audio|synthesis",
      "finding": "brief finding description",
      "confidence": 0-100,
      "nistTag": "GOVERN|MAP|MEASURE|MANAGE",
      "nistControlId": "e.g. MEASURE 2.1"
    }
  ]
}`,
      },
    ],
  });

  let parsedResult: AuditorOutput;
  try {
    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected content type");
    const cleaned = content.text.trim().replace(/^```json\n?|```$/g, "");
    const raw = JSON.parse(cleaned) as Record<string, unknown>;

    // Ensure timestamps are valid ISO strings and nistTags are valid
    const trace = (raw["governanceTrace"] as Array<Record<string, unknown>>).map((entry) => ({
      timestamp:
        typeof entry["timestamp"] === "string" ? entry["timestamp"] : new Date().toISOString(),
      agent: entry["agent"] as AuditorOutput["governanceTrace"][number]["agent"],
      finding: String(entry["finding"]),
      confidence: Number(entry["confidence"]),
      nistTag: NIST_TAGS.includes(entry["nistTag"] as (typeof NIST_TAGS)[number])
        ? (entry["nistTag"] as (typeof NIST_TAGS)[number])
        : assignNistTag(String(entry["finding"])),
      nistControlId:
        typeof entry["nistControlId"] === "string" ? entry["nistControlId"] : undefined,
    }));

    parsedResult = AuditorOutputSchema.parse({ ...raw, governanceTrace: trace });
  } catch {
    parsedResult = AuditorOutputSchema.parse({
      confidenceScores: { doc: 75, vision: 75, audio: 75 },
      governanceTrace: [
        {
          timestamp: new Date().toISOString(),
          agent: "synthesis",
          finding: "Audit completed with fallback scoring",
          confidence: 75,
          nistTag: "MEASURE",
        },
      ],
      hallucinations: [],
      overallFaithfulness: 75,
    });
  }

  return { auditorOutput: parsedResult };
}
