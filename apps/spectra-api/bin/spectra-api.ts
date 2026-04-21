#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import { StorageStack } from "../lib/stacks/storage-stack";
import { ComputeStack } from "../lib/stacks/compute-stack";
import { ObservabilityStack } from "../lib/stacks/observability-stack";

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

// Billing metrics (EstimatedCharges) only exist in us-east-1 — alarm must live there.
new ObservabilityStack(app, "SpectraObservabilityStack", {
  env: { account: process.env.AWS_ACCOUNT_ID, region: "us-east-1" },
  ingestHandler: computeStack.ingestHandler,
  jobProcessor: computeStack.jobProcessor,
  lambdaRegion: env.region ?? "eu-west-1",
});

app.synth();
