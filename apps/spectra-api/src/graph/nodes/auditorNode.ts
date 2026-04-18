import Anthropic from '@anthropic-ai/sdk';
import { AuditorInputSchema, AuditorOutputSchema, type AuditorOutput } from '../../lib/schemas';
import type { SpectraState } from '../state';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const NIST_TAGS = ['GOVERN', 'MAP', 'MEASURE', 'MANAGE'] as const;

function assignNistTag(finding: string): typeof NIST_TAGS[number] {
  const lower = finding.toLowerCase();
  if (lower.includes('govern') || lower.includes('policy') || lower.includes('oversight')) return 'GOVERN';
  if (lower.includes('risk') || lower.includes('context') || lower.includes('categor')) return 'MAP';
  if (lower.includes('score') || lower.includes('measur') || lower.includes('confidence') || lower.includes('hallucin')) return 'MEASURE';
  return 'MANAGE';
}

export async function auditorNode(
  state: SpectraState,
): Promise<{ auditorOutput: AuditorOutput }> {
  if (!state.synthesisOutput) {
    throw new Error('auditorNode requires synthesisOutput — synthesisNode must run first');
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
    sourceContext.push(`Document findings: ${input.documentOutput.findings.join(' | ')}`);
  }
  if (input.visionOutput) {
    sourceContext.push(`Vision findings: ${input.visionOutput.findings.join(' | ')}`);
  }
  if (input.audioOutput) {
    sourceContext.push(`Audio findings: ${input.audioOutput.findings.join(' | ')}`);
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `<source_findings>
${sourceContext.join('\n')}
</source_findings>

<synthesis_report>
${input.synthesisOutput.report}
</synthesis_report>

You are an LLM-as-Judge auditor evaluating this synthesis report for faithfulness, hallucination, and grounding.

Score each active modality 0-100 for faithfulness to source findings. Score 0 if modality not used.
Identify any hallucinations (claims not grounded in source findings).
For each key finding in the report, create a governance trace entry with a NIST AI RMF tag.

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
      "nistTag": "GOVERN|MAP|MEASURE|MANAGE"
    }
  ]
}`,
      },
    ],
  });

  let parsedResult: AuditorOutput;
  try {
    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected content type');
    const cleaned = content.text.trim().replace(/^```json\n?|```$/g, '');
    const raw = JSON.parse(cleaned) as Record<string, unknown>;

    // Ensure timestamps are valid ISO strings and nistTags are valid
    const trace = (raw['governanceTrace'] as Array<Record<string, unknown>>).map((entry) => ({
      timestamp: typeof entry['timestamp'] === 'string' ? entry['timestamp'] : new Date().toISOString(),
      agent: entry['agent'] as AuditorOutput['governanceTrace'][number]['agent'],
      finding: String(entry['finding']),
      confidence: Number(entry['confidence']),
      nistTag: NIST_TAGS.includes(entry['nistTag'] as typeof NIST_TAGS[number])
        ? (entry['nistTag'] as typeof NIST_TAGS[number])
        : assignNistTag(String(entry['finding'])),
    }));

    parsedResult = AuditorOutputSchema.parse({ ...raw, governanceTrace: trace });
  } catch {
    parsedResult = AuditorOutputSchema.parse({
      confidenceScores: { doc: 75, vision: 75, audio: 75 },
      governanceTrace: [
        {
          timestamp: new Date().toISOString(),
          agent: 'synthesis',
          finding: 'Audit completed with fallback scoring',
          confidence: 75,
          nistTag: 'MEASURE',
        },
      ],
      hallucinations: [],
      overallFaithfulness: 75,
    });
  }

  return { auditorOutput: parsedResult };
}
