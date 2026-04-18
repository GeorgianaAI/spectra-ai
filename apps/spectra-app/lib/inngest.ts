import { Inngest } from 'inngest';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export const inngest = new Inngest({ id: 'spectra-app' });

export const processJobFn = inngest.createFunction(
  { id: 'process-job', triggers: [{ event: 'spectra/job.process' }] },
  async ({ event }: { event: { data: { jobId: string; userId: string; s3Keys: Record<string, string> } } }) => {
    const lambda = new LambdaClient({ region: process.env.AWS_REGION ?? 'eu-west-1' });

    const lambdaEvent = {
      body: JSON.stringify(event.data),
      headers: { 'Content-Type': 'application/json' },
      httpMethod: 'POST',
      path: '/',
    };

    const response = await lambda.send(
      new InvokeCommand({
        FunctionName: process.env.AWS_LAMBDA_JOB_PROCESSOR_NAME ?? 'spectra-job-processor',
        Payload: Buffer.from(JSON.stringify(lambdaEvent)),
      }),
    );

    const statusCode = response.StatusCode ?? 0;
    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(`Lambda invocation failed with status ${statusCode}`);
    }

    return { status: 'invoked', jobId: event.data.jobId as string };
  },
);
