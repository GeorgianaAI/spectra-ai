import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';

interface ComputeStackProps extends cdk.StackProps {
  uploadsBucket: s3.Bucket;
}

export class ComputeStack extends cdk.Stack {
  readonly ingestHandler: lambda.Function;
  readonly jobProcessor: lambda.Function;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // ingestHandler: triggered by S3 ObjectCreated, validates upload, fires Inngest event
    const ingestLogGroup = new logs.LogGroup(this, 'IngestHandlerLogs', {
      logGroupName: '/aws/lambda/spectra-ingest-handler',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.ingestHandler = new lambda.Function(this, 'IngestHandler', {
      functionName: 'spectra-ingest-handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'ingestHandler.handler',
      code: lambda.Code.fromAsset('dist/src/handlers'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: ingestLogGroup,
      environment: {
        NODE_ENV: 'production',
        INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY ?? '',
        INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY ?? '',
        S3_BUCKET_NAME: props.uploadsBucket.bucketName,
      },
    });

    // Grant ingestHandler read access to the uploads bucket
    props.uploadsBucket.grantRead(this.ingestHandler);

    // S3 ObjectCreated → ingestHandler (all prefixes, all object types)
    props.uploadsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.ingestHandler),
    );

    // jobProcessor: triggered by Inngest HTTP, runs LangGraph, writes to Supabase
    const jobProcessorLogGroup = new logs.LogGroup(this, 'JobProcessorLogs', {
      logGroupName: '/aws/lambda/spectra-job-processor',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.jobProcessor = new lambda.Function(this, 'JobProcessor', {
      functionName: 'spectra-job-processor',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'jobProcessor.handler',
      code: lambda.Code.fromAsset('dist/src/handlers'),
      // Agent graph needs time: 300s timeout, 1024MB for embedding/model calls
      timeout: cdk.Duration.seconds(300),
      memorySize: 1024,
      // Single concurrency during demo period — prevents parallel runs stacking model costs
      reservedConcurrentExecutions: 1,
      logGroup: jobProcessorLogGroup,
      environment: {
        NODE_ENV: 'production',
        AWS_REGION_OVERRIDE: props.env?.region ?? 'eu-west-1',
        S3_BUCKET_NAME: props.uploadsBucket.bucketName,
        BEDROCK_NOVA_MICRO_MODEL_ID: process.env.BEDROCK_NOVA_MICRO_MODEL_ID ?? 'amazon.nova-micro-v1:0',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
        OPENAI_WHISPER_API_KEY: process.env.OPENAI_WHISPER_API_KEY ?? '',
        SUPABASE_URL: process.env.SUPABASE_URL ?? '',
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ?? '',
        UPSTASH_VECTOR_URL: process.env.UPSTASH_VECTOR_URL ?? '',
        UPSTASH_VECTOR_TOKEN: process.env.UPSTASH_VECTOR_TOKEN ?? '',
        UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL ?? '',
        UPSTASH_REDIS_TOKEN: process.env.UPSTASH_REDIS_TOKEN ?? '',
        LANGSMITH_API_KEY: process.env.LANGSMITH_API_KEY ?? '',
        LANGSMITH_PROJECT: process.env.LANGSMITH_PROJECT ?? 'spectra',
        LANGCHAIN_TRACING_V2: 'true',
        SENTRY_DSN: process.env.SENTRY_DSN ?? '',
        INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY ?? '',
      },
    });

    // Grant jobProcessor full access to the uploads bucket (needs to download files)
    props.uploadsBucket.grantReadWrite(this.jobProcessor);

    // Grant jobProcessor permission to call Bedrock (Nova Micro for Router Agent)
    this.jobProcessor.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${props.env?.region ?? 'eu-west-1'}::foundation-model/amazon.nova-micro-v1:0`,
        ],
      }),
    );

    new cdk.CfnOutput(this, 'IngestHandlerArn', {
      value: this.ingestHandler.functionArn,
      description: 'ingestHandler Lambda ARN',
    });

    new cdk.CfnOutput(this, 'JobProcessorArn', {
      value: this.jobProcessor.functionArn,
      description: 'jobProcessor Lambda ARN',
    });
  }
}
