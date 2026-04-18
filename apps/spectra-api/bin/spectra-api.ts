#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/stacks/storage-stack';
import { ComputeStack } from '../lib/stacks/compute-stack';
import { ObservabilityStack } from '../lib/stacks/observability-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.AWS_ACCOUNT_ID,
  region: process.env.AWS_REGION ?? 'eu-west-1',
};

const storageStack = new StorageStack(app, 'SpectraStorageStack', { env });

const computeStack = new ComputeStack(app, 'SpectraComputeStack', {
  env,
  uploadsBucketName: 'spectra-uploads',
});

// Billing metrics (EstimatedCharges) only exist in us-east-1 — alarm must live there.
new ObservabilityStack(app, 'SpectraObservabilityStack', {
  env: { account: process.env.AWS_ACCOUNT_ID, region: 'us-east-1' },
  ingestHandler: computeStack.ingestHandler,
  jobProcessor: computeStack.jobProcessor,
  lambdaRegion: env.region ?? 'eu-west-1',
});

app.synth();
