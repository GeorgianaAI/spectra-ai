import { Inngest } from "inngest";
import { LambdaClient, InvokeCommand, InvocationType } from "@aws-sdk/client-lambda";
import { getSupabaseClient } from "@/lib/supabase";

export const inngest = new Inngest({ id: "spectra-app" });

export const processJobFn = inngest.createFunction(
  { id: "process-job", triggers: [{ event: "spectra/job.process" }] },
  async ({
    event,
  }: {
    event: { data: { jobId: string; userId: string; s3Keys: Record<string, string> } };
  }) => {
    const lambda = new LambdaClient({
      region: process.env.LAMBDA_REGION ?? process.env.AWS_REGION ?? "eu-west-1",
    });

    const lambdaEvent = {
      body: JSON.stringify(event.data),
      headers: { "Content-Type": "application/json" },
      httpMethod: "POST",
      path: "/",
    };

    // Fire-and-forget (InvocationType.Event = async). The Lambda runs independently
    // and writes status updates directly to Supabase. Synchronous invocation would
    // time out Vercel's serverless function (10-60s) before Lambda completes (300s).
    const response = await lambda.send(
      new InvokeCommand({
        FunctionName: process.env.AWS_LAMBDA_JOB_PROCESSOR_NAME ?? "spectra-job-processor",
        InvocationType: InvocationType.Event,
        Payload: Buffer.from(JSON.stringify(lambdaEvent)),
      }),
    );

    // Async invocation returns 202 on success
    const statusCode = response.StatusCode ?? 0;
    if (statusCode !== 202) {
      throw new Error(`Lambda async invocation rejected with status ${statusCode}`);
    }

    return { status: "dispatched", jobId: event.data.jobId as string };
  },
);

// Fires Mon/Wed/Fri at 09:00 UTC — keeps Supabase project alive (archives after 7 days of inactivity).
export const keepaliveFn = inngest.createFunction(
  { id: "supabase-keepalive", triggers: [{ cron: "0 9 * * 1,3,5" }] },
  async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("jobs").select("id", { count: "exact", head: true });

    if (error) {
      throw new Error(`Keepalive DB ping failed: ${error.message}`);
    }

    return { status: "ok", timestamp: new Date().toISOString() };
  },
);
