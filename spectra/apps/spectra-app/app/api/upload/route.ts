/**
 * POST /api/upload
 *
 * Phase 3 implementation:
 *   1. Apply Upstash rate limiter (3 req/day/IP sliding window) — before any other logic.
 *   2. Validate JWT from Authorization header.
 *   3. Parse multipart form data: PDF (max 2MB), image (max 1MB), audio.
 *   4. Validate file types and sizes with Zod.
 *   5. Generate S3 presigned PUT URLs for each file.
 *   6. Upload files to S3 via presigned URLs.
 *   7. Create a job record in Supabase with status 'pending'.
 *   8. Fire Inngest event spectra/job.process with { jobId, userId, s3Keys }.
 *   9. Return { jobId } to the client.
 *
 * Returns consistent error shape: { error: string, code: string }
 */

import { NextResponse } from 'next/server';

export async function POST() {
  // Phase 3: implement upload logic
  return NextResponse.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, { status: 501 });
}
