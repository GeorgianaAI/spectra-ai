/**
 * ingestHandler — triggered by S3 ObjectCreated events.
 *
 * Responsibilities (Phase 2 implementation):
 *   1. Parse the S3 event to extract bucket name, object key, and file size.
 *   2. Validate file type (PDF / image / audio) and size (max 2 MB PDF, 1 MB image).
 *   3. Fire an Inngest event (spectra/job.process) to kick off the agent pipeline.
 *
 * Services this handler interacts with:
 *   - AWS S3 (via event payload — no SDK call needed at ingest time)
 *   - Inngest (HTTP POST to Inngest event API)
 *   - Supabase (job record creation delegated to Inngest function)
 */

import type { S3Event, S3Handler } from 'aws-lambda';

export const handler: S3Handler = async (event: S3Event): Promise<void> => {
  console.log('[ingestHandler] received S3 event', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const sizeBytes = record.s3.object.size;

    console.log(`[ingestHandler] processing object: s3://${bucket}/${key} (${sizeBytes} bytes)`);

    // Phase 2: validate file type, fire Inngest event spectra/job.process
  }
};
