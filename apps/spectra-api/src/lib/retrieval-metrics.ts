export const RETRIEVAL_QUALITY_FLOOR = 0.35;

export interface RetrievalMetrics {
  jobId: string;
  totalChunksEmbedded: number;
  topKRetrieved: number;
  minScore: number;
  maxScore: number;
  avgScore: number;
  aboveFloor: number;
  floor: number;
}

export function computeRetrievalMetrics(
  jobId: string,
  allChunkCount: number,
  topChunks: Array<{ relevanceScore: number }>,
): RetrievalMetrics {
  if (topChunks.length === 0) {
    return {
      jobId,
      totalChunksEmbedded: allChunkCount,
      topKRetrieved: 0,
      minScore: 0,
      maxScore: 0,
      avgScore: 0,
      aboveFloor: 0,
      floor: RETRIEVAL_QUALITY_FLOOR,
    };
  }

  const scores = topChunks.map((c) => c.relevanceScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const aboveFloor = scores.filter((s) => s >= RETRIEVAL_QUALITY_FLOOR).length;

  return {
    jobId,
    totalChunksEmbedded: allChunkCount,
    topKRetrieved: topChunks.length,
    minScore: parseFloat(minScore.toFixed(4)),
    maxScore: parseFloat(maxScore.toFixed(4)),
    avgScore: parseFloat(avgScore.toFixed(4)),
    aboveFloor,
    floor: RETRIEVAL_QUALITY_FLOOR,
  };
}

export function logRetrievalMetrics(metrics: RetrievalMetrics): void {
  console.log("[retrieval-metrics]", JSON.stringify(metrics));
}
