import * as Sentry from "@sentry/aws-serverless";
import type { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { spectraGraph } from "../graph/graph";
import { updateJobStatus, completeJob, failJob, getUserEmail } from "../lib/supabase-client";
import { sendJobCompletionEmail } from "../lib/resend-client";

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

    // Send completion email — non-critical: failure here must not fail the job
    if (process.env.RESEND_API_KEY) {
      const notificationTarget =
        process.env.NOTIFICATION_EMAIL ||
        (await getUserEmail(payload.userId).catch(() => null));
      if (notificationTarget) {
        await sendJobCompletionEmail(
          notificationTarget,
          jobId,
          result.auditorOutput.confidenceScores,
        ).catch((emailErr) => {
          Sentry.captureException(emailErr, { extra: { jobId, context: "completion-email" } });
          console.warn("[jobProcessor] completion email failed (non-fatal)", emailErr);
        });
      }
    }

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
