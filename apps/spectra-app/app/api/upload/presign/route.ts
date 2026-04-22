import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyJwt } from "@/lib/jwt";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "eu-west-1" });

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.UPSTASH_REDIS_URL ?? "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.UPSTASH_REDIS_TOKEN ?? "",
  }),
  limiter: Ratelimit.slidingWindow(3, "1 d"),
  prefix: "rl:upload",
});

const ALLOWED_TYPES: Record<
  string,
  { modality: "document" | "image" | "audio"; field: "document" | "vision" | "audio"; ext: string; maxBytes: number }
> = {
  "application/pdf": { modality: "document", field: "document", ext: "pdf", maxBytes: 2 * 1024 * 1024 },
  "image/jpeg": { modality: "image", field: "vision", ext: "jpg", maxBytes: 1 * 1024 * 1024 },
  "image/png": { modality: "image", field: "vision", ext: "png", maxBytes: 1 * 1024 * 1024 },
  "image/webp": { modality: "image", field: "vision", ext: "webp", maxBytes: 1 * 1024 * 1024 },
  "audio/mpeg": { modality: "audio", field: "audio", ext: "mp3", maxBytes: 50 * 1024 * 1024 },
  "audio/wav": { modality: "audio", field: "audio", ext: "wav", maxBytes: 50 * 1024 * 1024 },
  "audio/ogg": { modality: "audio", field: "audio", ext: "ogg", maxBytes: 50 * 1024 * 1024 },
};

const FileMetaSchema = z.object({
  contentType: z.string(),
  size: z.number().int().positive(),
});

const BodySchema = z.object({
  files: z.object({
    document: FileMetaSchema.optional(),
    vision: FileMetaSchema.optional(),
    audio: FileMetaSchema.optional(),
  }),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded — 3 jobs per day", code: "RATE_LIMITED" },
      { status: 429 },
    );
  }

  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing token", code: "UNAUTHORIZED" }, { status: 401 });
  }
  let userId: string;
  try {
    const claims = await verifyJwt(auth.slice(7));
    userId = claims.sub;
  } catch {
    return NextResponse.json({ error: "Invalid token", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "BAD_REQUEST" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const { files } = parsed.data;
  if (!files.document && !files.vision && !files.audio) {
    return NextResponse.json({ error: "No files provided", code: "BAD_REQUEST" }, { status: 400 });
  }

  const jobId = randomUUID();
  const uploadUrls: Record<string, string> = {};
  const s3Keys: Record<string, string> = {};
  const modalitiesUsed = { document: false, vision: false, audio: false };

  const entries = [
    { field: "document", meta: files.document },
    { field: "vision", meta: files.vision },
    { field: "audio", meta: files.audio },
  ] as const;

  for (const { field, meta } of entries) {
    if (!meta) continue;

    const allowed = ALLOWED_TYPES[meta.contentType];
    if (!allowed) {
      return NextResponse.json(
        { error: `Unsupported content type for ${field}: ${meta.contentType}`, code: "BAD_REQUEST" },
        { status: 400 },
      );
    }
    if (meta.size > allowed.maxBytes) {
      return NextResponse.json(
        { error: `${field} exceeds maximum size`, code: "BAD_REQUEST" },
        { status: 400 },
      );
    }

    const s3Key = `uploads/${userId}/${jobId}/${field}.${allowed.ext}`;
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME ?? "spectra-uploads",
        Key: s3Key,
        ContentType: meta.contentType,
      }),
      { expiresIn: 300 },
    );

    uploadUrls[field] = url;
    s3Keys[field === "vision" ? "image" : field] = s3Key;
    if (field === "document") modalitiesUsed.document = true;
    if (field === "vision") modalitiesUsed.vision = true;
    if (field === "audio") modalitiesUsed.audio = true;
  }

  const supabase = getSupabaseClient();
  const { error: dbError } = await supabase.from("jobs").insert({
    id: jobId,
    user_id: userId,
    status: "pending",
    modalities_used: modalitiesUsed,
  });
  if (dbError) {
    return NextResponse.json(
      { error: "Failed to create job", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }

  return NextResponse.json({ jobId, uploadUrls, s3Keys });
}
