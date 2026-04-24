import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface ComputeStackProps extends cdk.StackProps {
  // Bucket name only — avoids a CDK cross-stack token that would create a dependency cycle
  // with the S3 ObjectCreated notification wired in Phase 2.
  uploadsBucketName: string;
}

export class ComputeStack extends cdk.Stack {
  readonly ingestHandler: lambdaNode.NodejsFunction;
  readonly jobProcessor: lambdaNode.NodejsFunction;
  readonly ingestHandlerLogGroup: logs.LogGroup;
  readonly jobProcessorLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // ingestHandler: triggered by S3 ObjectCreated, validates upload metadata
    this.ingestHandlerLogGroup = new logs.LogGroup(this, "IngestHandlerLogs", {
      logGroupName: "/aws/lambda/spectra-ingest-handler",
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.ingestHandler = new lambdaNode.NodejsFunction(this, "IngestHandler", {
      functionName: "spectra-ingest-handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../../src/handlers/ingestHandler.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: this.ingestHandlerLogGroup,
      bundling: {
        minify: false,
        sourceMap: false,
        target: "node20",
        // Bundle all deps — node_modules are NOT available in Lambda without bundling
        externalModules: [],
      },
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
    this.jobProcessorLogGroup = new logs.LogGroup(this, "JobProcessorLogs", {
      logGroupName: "/aws/lambda/spectra-job-processor",
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.jobProcessor = new lambdaNode.NodejsFunction(this, "JobProcessor", {
      functionName: "spectra-job-processor",
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../../src/handlers/jobProcessor.ts"),
      handler: "handler",
      // Agent graph needs time: 300s timeout, 1024MB for embedding/model calls
      timeout: cdk.Duration.seconds(300),
      memorySize: 1024,
      logGroup: this.jobProcessorLogGroup,
      bundling: {
        minify: false,
        sourceMap: false,
        target: "node20",
        // Bundle all deps — node_modules are NOT available in Lambda without bundling
        externalModules: [],
      },
      environment: {
        NODE_ENV: "production",
        AWS_REGION_OVERRIDE: props.env?.region ?? "eu-west-1",
        S3_BUCKET_NAME: props.uploadsBucketName,
        BEDROCK_NOVA_MICRO_MODEL_ID:
          process.env.BEDROCK_NOVA_MICRO_MODEL_ID ?? "eu.amazon.nova-micro-v1:0",
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
        OPENAI_WHISPER_API_KEY: process.env.OPENAI_WHISPER_API_KEY ?? "",
        SUPABASE_URL: process.env.SUPABASE_URL ?? "",
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ?? "",
        UPSTASH_VECTOR_REST_URL: process.env.UPSTASH_VECTOR_REST_URL ?? "",
        UPSTASH_VECTOR_REST_TOKEN: process.env.UPSTASH_VECTOR_REST_TOKEN ?? "",
        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ?? "",
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
        LANGSMITH_API_KEY: process.env.LANGSMITH_API_KEY ?? "",
        LANGSMITH_PROJECT: process.env.LANGSMITH_PROJECT ?? "spectra",
        LANGSMITH_ENDPOINT: process.env.LANGSMITH_ENDPOINT ?? "",
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

    // Scheduled ping every 5 minutes keeps jobProcessor warm and avoids cold-start latency.
    const warmupRule = new events.Rule(this, "JobProcessorWarmup", {
      ruleName: "spectra-jobprocessor-warmup",
      description: "Keeps jobProcessor warm to avoid cold-start latency on first invocation",
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
    });
    warmupRule.addTarget(new targets.LambdaFunction(this.jobProcessor));

    // Grant jobProcessor permission to call Bedrock (Nova Micro for Router Agent)
    // Cross-region inference profile requires permission on the profile ARN plus
    // the foundation model in each EU region the profile may route to.
    this.jobProcessor.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:aws:bedrock:${props.env?.region ?? "eu-west-1"}::inference-profile/eu.amazon.nova-micro-v1:0`,
          "arn:aws:bedrock:eu-west-1::foundation-model/amazon.nova-micro-v1:0",
          "arn:aws:bedrock:eu-central-1::foundation-model/amazon.nova-micro-v1:0",
          "arn:aws:bedrock:eu-north-1::foundation-model/amazon.nova-micro-v1:0",
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
