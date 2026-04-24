import { Index } from "@upstash/vector";

function getVectorIndex(): Index {
  return new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL ?? "",
    token: process.env.UPSTASH_VECTOR_REST_TOKEN ?? "",
  });
}

export async function cleanupJobVectors(jobId: string, userId: string): Promise<void> {
  const index = getVectorIndex();
  const namespace = `${jobId}_${userId}`;

  try {
    await index.deleteNamespace(namespace);
    console.log(`[vector-cleanup] deleted namespace for job ${jobId}`);
  } catch (err) {
    console.warn(`[vector-cleanup] failed to delete namespace for job ${jobId}:`, err);
  }
}
