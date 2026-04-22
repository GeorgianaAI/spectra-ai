import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class StorageStack extends cdk.Stack {
  readonly uploadsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    this.uploadsBucket = new s3.Bucket(this, "SpectraUploads", {
      bucketName: "spectra-uploads",
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      // Objects archived to Glacier after 30 days, deleted after 365
      lifecycleRules: [
        {
          id: "archive-and-expire",
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
          expiration: cdk.Duration.days(365),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          // Locked to the production domain — remove the wildcard *.vercel.app entry.
          // Update PRODUCTION_ORIGIN env var when a custom domain is assigned.
          allowedOrigins: [
            process.env.PRODUCTION_ORIGIN ?? "https://spectra-ai-app.vercel.app",
            "http://localhost:3000",
          ],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, "UploadsBucketName", {
      value: this.uploadsBucket.bucketName,
      description: "S3 bucket name for file uploads",
    });

    new cdk.CfnOutput(this, "UploadsBucketArn", {
      value: this.uploadsBucket.bucketArn,
      description: "S3 bucket ARN for file uploads",
    });
  }
}
