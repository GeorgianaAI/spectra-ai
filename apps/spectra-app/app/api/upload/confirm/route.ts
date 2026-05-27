import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAuth } from "@/lib/apiHelpers";
import { inngest } from "@/lib/inngest";

const BodySchema = z.object({
  jobId: z.string().uuid(),
  s3Keys: z.object({
    document: z.string().optional(),
    image: z.string().optional(),
    audio: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
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

  const { jobId, s3Keys } = parsed.data;

  const supabase = getSupabaseClient();
  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, user_id, status")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: "Job not found", code: "NOT_FOUND" }, { status: 404 });
  }
  if (job.status !== "pending") {
    return NextResponse.json(
      { error: "Job already confirmed or in progress", code: "CONFLICT" },
      { status: 409 },
    );
  }

  await inngest.send({
    id: jobId,
    name: "spectra/job.process",
    data: { jobId, userId, s3Keys },
  });

  return NextResponse.json({ jobId });
}
