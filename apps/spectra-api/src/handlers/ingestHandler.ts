import * as Sentry from "@sentry/aws-serverless";
import type { S3Event, S3Handler } from "aws-lambda";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "production",
  tracesSampleRate: 0.2,
});

const INNGEST_EVENT_URL = `${process.env.INNGEST_BASE_URL ?? "https://inn.gs"}/e/${process.env.INNGEST_EVENT_KEY}`;

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

    const { userId, jobId, modality } = parsed;

    if (sizeBytes > MAX_BYTES[modality]) {
      console.warn(
        `[ingestHandler] skipping — ${modality} exceeds size limit (${sizeBytes} > ${MAX_BYTES[modality]})`,
      );
      continue;
    }

    const s3Keys: Record<string, string> = {};
    if (modality === "document") s3Keys["document"] = key;
    if (modality === "image") s3Keys["image"] = key;
    if (modality === "audio") s3Keys["audio"] = key;

    const inngestPayload = {
      id: jobId,
      name: "spectra/job.process",
      data: { jobId, userId, s3Keys },
    };

    try {
      const response = await fetch(INNGEST_EVENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inngestPayload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Inngest event failed: ${response.status} ${text}`);
      }

      console.log(`[ingestHandler] Inngest event sent for job ${jobId}`);
    } catch (err) {
      Sentry.captureException(err, { extra: { bucket, key, jobId } });
      throw err;
    }
  }
};

export const handler = Sentry.wrapHandler(rawHandler);
