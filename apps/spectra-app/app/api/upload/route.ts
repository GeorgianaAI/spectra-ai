import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { randomUUID } from "crypto";
import { getSupabaseClient } from "@/lib/supabase";
import { inngest } from "@/lib/inngest";
import { getClientIp, requireAuth } from "@/lib/apiHelpers";
import { ALLOWED_TYPES } from "@/lib/uploadConstants";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "eu-west-1" });

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, "1 d"),
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data", code: "BAD_REQUEST" }, { status: 400 });
  }

  const jobId = randomUUID();
  const s3Keys: { document?: string; image?: string; audio?: string } = {};
  const modalitiesUsed: { document: boolean; vision: boolean; audio: boolean } = {
    document: false,
    vision: false,
    audio: false,
  };

  const fieldNames = ["document", "vision", "audio"] as const;
  for (const field of fieldNames) {
    const file = form.get(field);
    if (!file || !(file instanceof File)) continue;

    const meta = ALLOWED_TYPES[file.type];
    if (!meta) {
      return NextResponse.json(
        { error: `Unsupported file type for ${field}: ${file.type}`, code: "BAD_REQUEST" },
        { status: 400 },
      );
    }
    if (file.size > meta.maxBytes) {
      return NextResponse.json(
        { error: `${field} exceeds maximum size`, code: "BAD_REQUEST" },
        { status: 400 },
      );
    }

    const s3Key = `uploads/${userId}/${jobId}/${field}.${meta.ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME ?? "spectra-uploads",
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
      }),
    );

    if (meta.modality === "document") s3Keys.document = s3Key;
    if (meta.modality === "image") s3Keys.image = s3Key;
    if (meta.modality === "audio") s3Keys.audio = s3Key;

    modalitiesUsed.document = modalitiesUsed.document || field === "document";
    modalitiesUsed.vision = modalitiesUsed.vision || field === "vision";
    modalitiesUsed.audio = modalitiesUsed.audio || field === "audio";
  }

  if (Object.keys(s3Keys).length === 0) {
    return NextResponse.json(
      { error: "No valid files provided", code: "BAD_REQUEST" },
      { status: 400 },
    );
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

  await inngest.send({
    id: jobId,
    name: "spectra/job.process",
    data: { jobId, userId, s3Keys },
  });

  return NextResponse.json({ jobId });
}
