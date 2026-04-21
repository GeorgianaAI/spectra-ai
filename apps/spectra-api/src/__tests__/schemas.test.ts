import { describe, expect, it } from "vitest";
import {
  RouterInputSchema,
  RouterOutputSchema,
  DocumentInputSchema,
  DocumentOutputSchema,
  VisionInputSchema,
  VisionOutputSchema,
  AudioInputSchema,
  AudioOutputSchema,
  SynthesisInputSchema,
  SynthesisOutputSchema,
  AuditorInputSchema,
  AuditorOutputSchema,
} from "../lib/schemas";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("RouterInputSchema", () => {
  it("accepts valid input with all s3 keys", () => {
    expect(() =>
      RouterInputSchema.parse({
        jobId: VALID_UUID,
        userId: VALID_UUID,
        s3Keys: { document: "uploads/doc.pdf", image: "uploads/img.png", audio: "uploads/audio.mp3" },
      }),
    ).not.toThrow();
  });

  it("accepts input with no s3 keys", () => {
    expect(() =>
      RouterInputSchema.parse({ jobId: VALID_UUID, userId: VALID_UUID, s3Keys: {} }),
    ).not.toThrow();
  });

  it("rejects non-UUID jobId", () => {
    expect(() =>
      RouterInputSchema.parse({ jobId: "not-a-uuid", userId: VALID_UUID, s3Keys: {} }),
    ).toThrow();
  });
});

describe("RouterOutputSchema", () => {
  it("accepts valid modalities", () => {
    expect(() =>
      RouterOutputSchema.parse({
        jobId: VALID_UUID,
        activeModalities: ["document", "vision"],
        s3Keys: { document: "uploads/doc.pdf" },
      }),
    ).not.toThrow();
  });

  it("rejects unknown modality", () => {
    expect(() =>
      RouterOutputSchema.parse({
        jobId: VALID_UUID,
        activeModalities: ["document", "unknown"],
        s3Keys: {},
      }),
    ).toThrow();
  });
});

describe("DocumentOutputSchema", () => {
  it("accepts valid output", () => {
    expect(() =>
      DocumentOutputSchema.parse({
        findings: ["Finding one", "Finding two"],
        citations: [{ id: "D1", chunk: "chunk text", relevanceScore: 0.95 }],
        redactedFields: ["email"],
      }),
    ).not.toThrow();
  });

  it("accepts citations with optional page field", () => {
    expect(() =>
      DocumentOutputSchema.parse({
        findings: [],
        citations: [{ id: "D1", page: 3, chunk: "text", relevanceScore: 0.8 }],
        redactedFields: [],
      }),
    ).not.toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() => DocumentOutputSchema.parse({ findings: [] })).toThrow();
  });
});

describe("VisionOutputSchema", () => {
  it("accepts valid vision output", () => {
    expect(() =>
      VisionOutputSchema.parse({
        findings: ["anomaly detected"],
        annotations: [{ label: "person", confidence: 0.97 }],
        rawDescription: "An image showing a person",
      }),
    ).not.toThrow();
  });

  it("rejects missing rawDescription", () => {
    expect(() =>
      VisionOutputSchema.parse({
        findings: [],
        annotations: [],
      }),
    ).toThrow();
  });
});

describe("AudioOutputSchema", () => {
  it("accepts valid audio output", () => {
    expect(() =>
      AudioOutputSchema.parse({
        transcript: "Hello world",
        findings: ["speaker mentioned deadline"],
        durationSeconds: 42.5,
      }),
    ).not.toThrow();
  });

  it("rejects missing durationSeconds", () => {
    expect(() =>
      AudioOutputSchema.parse({ transcript: "Hello", findings: [] }),
    ).toThrow();
  });
});

describe("AuditorOutputSchema", () => {
  it("accepts valid auditor output", () => {
    expect(() =>
      AuditorOutputSchema.parse({
        confidenceScores: { doc: 92, vision: 87, audio: 95 },
        governanceTrace: [
          {
            timestamp: "2026-04-21T10:00:00.000Z",
            agent: "document",
            finding: "PII detected and redacted",
            confidence: 90,
            nistTag: "GOVERN",
          },
        ],
        hallucinations: [],
        overallFaithfulness: 91,
      }),
    ).not.toThrow();
  });

  it("rejects confidence score above 100", () => {
    expect(() =>
      AuditorOutputSchema.parse({
        confidenceScores: { doc: 101, vision: 87, audio: 95 },
        governanceTrace: [],
        hallucinations: [],
        overallFaithfulness: 91,
      }),
    ).toThrow();
  });

  it("rejects invalid NIST tag", () => {
    expect(() =>
      AuditorOutputSchema.parse({
        confidenceScores: { doc: 90, vision: 87, audio: 95 },
        governanceTrace: [
          {
            timestamp: "2026-04-21T10:00:00.000Z",
            agent: "document",
            finding: "test",
            confidence: 90,
            nistTag: "INVALID_TAG",
          },
        ],
        hallucinations: [],
        overallFaithfulness: 91,
      }),
    ).toThrow();
  });

  it("rejects invalid agent name in governance trace", () => {
    expect(() =>
      AuditorOutputSchema.parse({
        confidenceScores: { doc: 90, vision: 87, audio: 95 },
        governanceTrace: [
          {
            timestamp: "2026-04-21T10:00:00.000Z",
            agent: "router",
            finding: "test",
            confidence: 90,
            nistTag: "MAP",
          },
        ],
        hallucinations: [],
        overallFaithfulness: 91,
      }),
    ).toThrow();
  });
});

describe("SynthesisOutputSchema", () => {
  it("accepts valid synthesis output", () => {
    expect(() =>
      SynthesisOutputSchema.parse({
        report: "The analysis shows [D1] evidence of anomaly [V2].",
        citations: [
          { id: "D1", modality: "document", source: "page 3" },
          { id: "V2", modality: "vision", source: "image region A" },
        ],
        conflicts: [],
      }),
    ).not.toThrow();
  });

  it("rejects invalid modality in citation", () => {
    expect(() =>
      SynthesisOutputSchema.parse({
        report: "test",
        citations: [{ id: "X1", modality: "unknown", source: "test" }],
        conflicts: [],
      }),
    ).toThrow();
  });
});

describe("Schema input validation (cross-node)", () => {
  it("DocumentInputSchema rejects missing s3Key", () => {
    expect(() =>
      DocumentInputSchema.parse({ jobId: VALID_UUID, userId: VALID_UUID }),
    ).toThrow();
  });

  it("VisionInputSchema rejects missing s3Key", () => {
    expect(() => VisionInputSchema.parse({ jobId: VALID_UUID })).toThrow();
  });

  it("AudioInputSchema rejects missing s3Key", () => {
    expect(() => AudioInputSchema.parse({ jobId: VALID_UUID })).toThrow();
  });

  it("SynthesisInputSchema accepts empty activeModalities", () => {
    expect(() =>
      SynthesisInputSchema.parse({ jobId: VALID_UUID, activeModalities: [] }),
    ).not.toThrow();
  });

  it("AuditorInputSchema requires synthesisOutput", () => {
    expect(() => AuditorInputSchema.parse({ jobId: VALID_UUID })).toThrow();
  });
});
