import { invokeNovaMicro } from '../../lib/bedrock-client';
import { RouterInputSchema, RouterOutputSchema, type RouterOutput } from '../../lib/schemas';
import type { SpectraState } from '../state';

export async function routerNode(state: SpectraState): Promise<Partial<SpectraState>> {
  const input = RouterInputSchema.parse({
    jobId: state.jobId,
    s3Keys: state.s3Keys,
    userId: state.userId,
  });

  const presentKeys = Object.entries(input.s3Keys)
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k)
    .join(', ');

  const response = await invokeNovaMicro(
    [
      {
        role: 'user',
        content: `Job ${input.jobId} contains the following uploaded file types: ${presentKeys || 'none'}.
Return a JSON object with key "activeModalities" — an array containing only the modalities present.
Valid values: "document", "vision", "audio".
Map: document key → "document", image key → "vision", audio key → "audio".
Respond with ONLY the JSON object, no explanation.`,
      },
    ],
    'You are a routing classifier for a multimodal AI pipeline. Classify which agent modalities are needed.',
  );

  let activeModalities: Array<'document' | 'vision' | 'audio'>;
  try {
    const cleaned = response.trim().replace(/^```json\n?|```$/g, '');
    const parsed = JSON.parse(cleaned) as { activeModalities: Array<'document' | 'vision' | 'audio'> };
    activeModalities = parsed.activeModalities;
  } catch {
    // Fallback: infer from s3Keys directly if Nova Micro response is malformed
    activeModalities = [];
    if (input.s3Keys.document) activeModalities.push('document');
    if (input.s3Keys.image) activeModalities.push('vision');
    if (input.s3Keys.audio) activeModalities.push('audio');
  }

  const output: RouterOutput = RouterOutputSchema.parse({
    jobId: input.jobId,
    activeModalities,
    s3Keys: input.s3Keys,
  });

  return {
    activeModalities: output.activeModalities,
    s3Keys: output.s3Keys,
  };
}
