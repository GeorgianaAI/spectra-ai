import { Index } from "@upstash/vector";

function getVectorIndex(): Index {
  return new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL ?? "",
    token: process.env.UPSTASH_VECTOR_REST_TOKEN ?? "",
  });
}

/**
 * Deletes all vectors stored under {jobId}/{userId}/ regardless of pipeline
 * completion state. Called on both success and failure to prevent orphaned
 * chunks from accumulating in the Upstash index.
 */
export async function cleanupJobVectors(jobId: string, userId: string): Promise<void> {
  const index = getVectorIndex();
  const namespace = `${jobId}/${userId}`;

  try {
    // Fetch all vector IDs in this job's namespace (up to 50 chunks per job).
    const ids = Array.from({ length: 50 }, (_, i) => `${namespace}/${i}`);
    await index.delete(ids);
    console.log(`[vector-cleanup] deleted vectors for job ${jobId}`);
  } catch (err) {
    // Swallow cleanup errors — they must never fail the job status update.
    console.warn(`[vector-cleanup] failed to delete vectors for job ${jobId}:`, err);
  }
}
