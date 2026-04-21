import type { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { spectraGraph } from "../graph/graph";
import { updateJobStatus, completeJob, failJob } from "../lib/supabase-client";

const JobPayloadSchema = z.object({
  jobId: z.string().uuid(),
  userId: z.string().uuid(),
  s3Keys: z.object({
    document: z.string().optional(),
    image: z.string().optional(),
    audio: z.string().optional(),
  }),
});

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  let jobId: string | undefined;

  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const payload = JobPayloadSchema.parse(body);
    jobId = payload.jobId;

    await updateJobStatus(jobId, "processing");

    const threadId = `${payload.userId}/${jobId}`;
    const result = await spectraGraph.invoke(
      {
        jobId: payload.jobId,
        userId: payload.userId,
        s3Keys: payload.s3Keys,
        activeModalities: [],
        documentOutput: undefined,
        visionOutput: undefined,
        audioOutput: undefined,
        synthesisOutput: undefined,
        auditorOutput: undefined,
      },
      { configurable: { thread_id: threadId } },
    );

    if (!result.auditorOutput || !result.synthesisOutput) {
      throw new Error("Graph completed without required outputs");
    }

    await completeJob(
      jobId,
      result.auditorOutput.confidenceScores,
      result.auditorOutput.governanceTrace,
      result.synthesisOutput.report,
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ status: "completed", jobId }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[jobProcessor] error", message, err);

    if (jobId) {
      await failJob(jobId, message).catch(() => {});
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ status: "failed", error: message }),
    };
  }
};
