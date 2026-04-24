import * as Sentry from "@sentry/aws-serverless";
import type { S3Event, S3Handler } from "aws-lambda";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "production",
  tracesSampleRate: 0.2,
});

const ALLOWED_EXTENSIONS: Record<string, "document" | "image" | "audio"> = {
  pdf: "document",
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  gif: "image",
  mp3: "audio",
  mp4: "audio",
  wav: "audio",
  m4a: "audio",
  ogg: "audio",
  flac: "audio",
  webm: "audio",
};

// S3 key format: uploads/{userId}/{jobId}/{filename}
function parseS3Key(
  key: string,
): { userId: string; jobId: string; modality: "document" | "image" | "audio" } | null {
  const parts = key.split("/");
  if (parts.length < 4 || parts[0] !== "uploads") return null;

  const userId = parts[1];
  const jobId = parts[2];
  const filename = parts[3];
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const modality = ALLOWED_EXTENSIONS[ext];

  if (!userId || !jobId || !modality) return null;
  return { userId, jobId, modality };
}

const MAX_BYTES: Record<"document" | "image" | "audio", number> = {
  document: 2 * 1024 * 1024,
  image: 1 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
};

// Validates and logs S3 uploads. Job processing is triggered by the
// /api/upload/confirm endpoint, which fires once with all s3Keys after
// all files have finished uploading. This handler must NOT send Inngest
// events — doing so causes duplicate triggers and idempotency key collisions.
const rawHandler: S3Handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const sizeBytes = record.s3.object.size;

    console.log(`[ingestHandler] s3://${bucket}/${key} (${sizeBytes} bytes)`);

    const parsed = parseS3Key(key);
    if (!parsed) {
      console.warn(`[ingestHandler] skipping — key format unrecognised: ${key}`);
      continue;
    }

    const { jobId, modality } = parsed;

    if (sizeBytes > MAX_BYTES[modality]) {
      console.warn(
        `[ingestHandler] oversized ${modality} for job ${jobId} (${sizeBytes} > ${MAX_BYTES[modality]})`,
      );
      continue;
    }

    console.log(`[ingestHandler] validated ${modality} upload for job ${jobId}`);
  }
};

export const handler = Sentry.wrapHandler(rawHandler);
