import { z } from "zod";

// ─── Router ───────────────────────────────────────────────────────────────────

export const RouterInputSchema = z.object({
  jobId: z.string().uuid(),
  s3Keys: z.object({
    document: z.string().optional(),
    image: z.string().optional(),
    audio: z.string().optional(),
  }),
  userId: z.string().uuid(),
});

export const RouterOutputSchema = z.object({
  jobId: z.string().uuid(),
  activeModalities: z.array(z.enum(["document", "vision", "audio"])),
  s3Keys: z.object({
    document: z.string().optional(),
    image: z.string().optional(),
    audio: z.string().optional(),
  }),
});

// ─── Document Agent ───────────────────────────────────────────────────────────

export const DocumentInputSchema = z.object({
  jobId: z.string().uuid(),
  s3Key: z.string(),
  userId: z.string().uuid(),
});

export const DocumentOutputSchema = z.object({
  findings: z.array(z.string()),
  citations: z.array(
    z.object({
      id: z.string(),
      page: z.number().optional(),
      chunk: z.string(),
      relevanceScore: z.number(),
    }),
  ),
  redactedFields: z.array(z.string()),
});

// ─── Vision Agent ─────────────────────────────────────────────────────────────

export const VisionInputSchema = z.object({
  jobId: z.string().uuid(),
  s3Key: z.string(),
});

export const VisionOutputSchema = z.object({
  findings: z.array(z.string()),
  annotations: z.array(
    z.object({
      label: z.string(),
      confidence: z.number(),
      boundingDescription: z.string().optional(),
    }),
  ),
  rawDescription: z.string(),
  redactedFields: z.array(z.string()).default([]),
});

// ─── Audio Agent ──────────────────────────────────────────────────────────────

export const AudioInputSchema = z.object({
  jobId: z.string().uuid(),
  s3Key: z.string(),
});

export const AudioOutputSchema = z.object({
  transcript: z.string(),
  findings: z.array(z.string()),
  durationSeconds: z.number(),
  redactedFields: z.array(z.string()).default([]),
});

// ─── Synthesis Agent ──────────────────────────────────────────────────────────

export const SynthesisInputSchema = z.object({
  jobId: z.string().uuid(),
  documentOutput: DocumentOutputSchema.optional(),
  visionOutput: VisionOutputSchema.optional(),
  audioOutput: AudioOutputSchema.optional(),
  activeModalities: z.array(z.enum(["document", "vision", "audio"])),
});

export const SynthesisOutputSchema = z.object({
  report: z.string(),
  citations: z.array(
    z.object({
      id: z.string(),
      modality: z.enum(["document", "vision", "audio"]),
      source: z.string(),
    }),
  ),
  conflicts: z.array(
    z.object({
      description: z.string(),
      modalitiesInvolved: z.array(z.string()),
    }),
  ),
});

// ─── Auditor ──────────────────────────────────────────────────────────────────

export const AuditorInputSchema = z.object({
  jobId: z.string().uuid(),
  synthesisOutput: SynthesisOutputSchema,
  documentOutput: DocumentOutputSchema.optional(),
  visionOutput: VisionOutputSchema.optional(),
  audioOutput: AudioOutputSchema.optional(),
});

export const AuditorOutputSchema = z.object({
  confidenceScores: z.object({
    doc: z.number().min(0).max(100),
    vision: z.number().min(0).max(100),
    audio: z.number().min(0).max(100),
  }),
  governanceTrace: z.array(
    z.object({
      timestamp: z.string(),
      agent: z.enum(["document", "vision", "audio", "synthesis"]),
      finding: z.string(),
      confidence: z.number().min(0).max(100),
      nistTag: z.enum(["GOVERN", "MAP", "MEASURE", "MANAGE"]),
      nistControlId: z.string().optional(),
    }),
  ),
  hallucinations: z.array(z.string()),
  overallFaithfulness: z.number().min(0).max(100),
});

// ─── Inferred TypeScript types ────────────────────────────────────────────────

export type RouterInput = z.infer<typeof RouterInputSchema>;
export type RouterOutput = z.infer<typeof RouterOutputSchema>;
export type DocumentInput = z.infer<typeof DocumentInputSchema>;
export type DocumentOutput = z.infer<typeof DocumentOutputSchema>;
export type VisionInput = z.infer<typeof VisionInputSchema>;
export type VisionOutput = z.infer<typeof VisionOutputSchema>;
export type AudioInput = z.infer<typeof AudioInputSchema>;
export type AudioOutput = z.infer<typeof AudioOutputSchema>;
export type SynthesisInput = z.infer<typeof SynthesisInputSchema>;
export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;
export type AuditorInput = z.infer<typeof AuditorInputSchema>;
export type AuditorOutput = z.infer<typeof AuditorOutputSchema>;
