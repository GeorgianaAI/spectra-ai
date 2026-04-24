#!/usr/bin/env node
import "source-map-support/register";
import * as dotenv from "dotenv";
dotenv.config();
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import { StorageStack } from "../lib/stacks/storage-stack";
import { ComputeStack } from "../lib/stacks/compute-stack";
import { ObservabilityStack } from "../lib/stacks/observability-stack";
import { BillingAlarmStack } from "../lib/stacks/billing-alarm-stack";

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.AWS_ACCOUNT_ID,
  region: process.env.AWS_REGION ?? "eu-west-1",
};

const storageStack = new StorageStack(app, "SpectraStorageStack", { env });

const computeStack = new ComputeStack(app, "SpectraComputeStack", {
  env,
  uploadsBucketName: "spectra-uploads",
});

// Wire S3 ObjectCreated → ingestHandler. Both stacks are instantiated here so there is no
// circular dependency: StorageStack holds no reference to ComputeStack, and vice versa.
// CDK will export the Lambda ARN from ComputeStack and import it into the bucket notification
// in StorageStack, resolving deployment order automatically.
storageStack.uploadsBucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3n.LambdaDestination(computeStack.ingestHandler),
  { prefix: "uploads/" },
);

// ObservabilityStack — eu-west-1 (same region as Lambdas).
// Contains: MetricFilters, Lambda error alarms, CloudWatch dashboard.
// CDK enforces that a cloudwatch.Alarm must live in the same region as its metric.
// Lambda log groups are in eu-west-1, so MetricFilters must be too.
new ObservabilityStack(app, "SpectraObservabilityStack", {
  env,
  ingestHandler: computeStack.ingestHandler,
  jobProcessor: computeStack.jobProcessor,
  ingestHandlerLogGroup: computeStack.ingestHandlerLogGroup,
  jobProcessorLogGroup: computeStack.jobProcessorLogGroup,
  lambdaRegion: env.region ?? "eu-west-1",
});

// BillingAlarmStack — us-east-1 (required by AWS).
// AWS/Billing EstimatedCharges metrics only exist in us-east-1, and CDK
// enforces that an Alarm must live in the same region as its metric.
// This is a standalone stack with its own SNS topic + email subscription.
new BillingAlarmStack(app, "SpectraBillingAlarmStack", {
  env: { account: process.env.AWS_ACCOUNT_ID, region: "us-east-1" },
});

app.synth();
