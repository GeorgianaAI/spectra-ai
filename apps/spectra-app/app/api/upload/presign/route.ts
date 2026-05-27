import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase";
import { getClientIp, requireAuth } from "@/lib/apiHelpers";
import { ALLOWED_TYPES } from "@/lib/uploadConstants";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "eu-west-1" });

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, "1 d"),
  prefix: "rl:upload",
});

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
  const ip = getClientIp(request);
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded — 3 jobs per day", code: "RATE_LIMITED" },
      { status: 429 },
    );
  }

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "BAD_REQUEST" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", code: "BAD_REQUEST" },
      { status: 400 },
    );
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
        {
          error: `Unsupported content type for ${field}: ${meta.contentType}`,
          code: "BAD_REQUEST",
        },
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
