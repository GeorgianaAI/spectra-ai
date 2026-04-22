import * as Sentry from "@sentry/aws-serverless";
import type { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { spectraGraph } from "../graph/graph";
import { updateJobStatus, completeJob, failJob } from "../lib/supabase-client";
import {
  faithfulnessEvaluator,
  citationAccuracyEvaluator,
  logEvaluations,
} from "../lib/langsmith-evaluators";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "production",
  tracesSampleRate: 0.2,
});

const JobPayloadSchema = z.object({
  jobId: z.string().uuid(),
  userId: z.string().uuid(),
  s3Keys: z.object({
    document: z.string().optional(),
    image: z.string().optional(),
    audio: z.string().optional(),
  }),
});

const rawHandler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const rawEvent = event as unknown as Record<string, unknown>;
  if (rawEvent["source"] === "aws.events") {
    console.log("[jobProcessor] warmup ping — staying warm");
    return { statusCode: 200, body: JSON.stringify({ status: "warm" }) };
  }

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

    const evaluations = [
      faithfulnessEvaluator(result.auditorOutput),
      citationAccuracyEvaluator(result.synthesisOutput, result.auditorOutput),
    ];
    logEvaluations(jobId, evaluations);

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
    Sentry.captureException(err, { extra: { jobId } });
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

export const handler = Sentry.wrapHandler(rawHandler);
