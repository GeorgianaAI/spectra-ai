import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface ComputeStackProps extends cdk.StackProps {
  // Bucket name only — avoids a CDK cross-stack token that would create a dependency cycle
  // with the S3 ObjectCreated notification wired in Phase 2.
  uploadsBucketName: string;
}

export class ComputeStack extends cdk.Stack {
  readonly ingestHandler: lambda.Function;
  readonly jobProcessor: lambda.Function;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // ingestHandler: triggered by S3 ObjectCreated, validates upload, fires Inngest event
    const ingestLogGroup = new logs.LogGroup(this, "IngestHandlerLogs", {
      logGroupName: "/aws/lambda/spectra-ingest-handler",
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.ingestHandler = new lambda.Function(this, "IngestHandler", {
      functionName: "spectra-ingest-handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "ingestHandler.handler",
      code: lambda.Code.fromAsset("dist/src/handlers"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: ingestLogGroup,
      environment: {
        NODE_ENV: "production",
        INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY ?? "",
        INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY ?? "",
        INNGEST_BASE_URL: process.env.INNGEST_BASE_URL ?? "https://inn.gs",
        S3_BUCKET_NAME: props.uploadsBucketName,
      },
    });

    // Explicit IAM policy — avoids CDK cross-stack token that causes the StorageStack/ComputeStack cycle.
    // S3 ARNs never include account/region so these are literal strings with no CDK dependency.
    const bucketArn = `arn:aws:s3:::${props.uploadsBucketName}`;
    this.ingestHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:ListBucket"],
        resources: [bucketArn, `${bucketArn}/*`],
      }),
    );
    // S3 ObjectCreated → ingestHandler notification wired in Phase 2.

    // jobProcessor: triggered by Inngest HTTP, runs LangGraph, writes to Supabase
    const jobProcessorLogGroup = new logs.LogGroup(this, "JobProcessorLogs", {
      logGroupName: "/aws/lambda/spectra-job-processor",
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.jobProcessor = new lambda.Function(this, "JobProcessor", {
      functionName: "spectra-job-processor",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "jobProcessor.handler",
      code: lambda.Code.fromAsset("dist/src/handlers"),
      // Agent graph needs time: 300s timeout, 1024MB for embedding/model calls
      timeout: cdk.Duration.seconds(300),
      memorySize: 1024,
      logGroup: jobProcessorLogGroup,
      environment: {
        NODE_ENV: "production",
        AWS_REGION_OVERRIDE: props.env?.region ?? "eu-west-1",
        S3_BUCKET_NAME: props.uploadsBucketName,
        BEDROCK_NOVA_MICRO_MODEL_ID:
          process.env.BEDROCK_NOVA_MICRO_MODEL_ID ?? "amazon.nova-micro-v1:0",
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
        OPENAI_WHISPER_API_KEY: process.env.OPENAI_WHISPER_API_KEY ?? "",
        SUPABASE_URL: process.env.SUPABASE_URL ?? "",
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ?? "",
        UPSTASH_VECTOR_URL: process.env.UPSTASH_VECTOR_URL ?? "",
        UPSTASH_VECTOR_TOKEN: process.env.UPSTASH_VECTOR_TOKEN ?? "",
        UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL ?? "",
        UPSTASH_REDIS_TOKEN: process.env.UPSTASH_REDIS_TOKEN ?? "",
        LANGSMITH_API_KEY: process.env.LANGSMITH_API_KEY ?? "",
        LANGSMITH_PROJECT: process.env.LANGSMITH_PROJECT ?? "spectra",
        LANGCHAIN_TRACING_V2: "true",
        SENTRY_DSN: process.env.SENTRY_DSN ?? "",
        INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY ?? "",
      },
    });

    this.jobProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
        resources: [bucketArn, `${bucketArn}/*`],
      }),
    );

    // Grant jobProcessor permission to call Bedrock (Nova Micro for Router Agent)
    this.jobProcessor.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:aws:bedrock:${props.env?.region ?? "eu-west-1"}::foundation-model/amazon.nova-micro-v1:0`,
        ],
      }),
    );

    new cdk.CfnOutput(this, "IngestHandlerArn", {
      value: this.ingestHandler.functionArn,
      description: "ingestHandler Lambda ARN",
    });

    new cdk.CfnOutput(this, "JobProcessorArn", {
      value: this.jobProcessor.functionArn,
      description: "jobProcessor Lambda ARN",
    });
  }
}
