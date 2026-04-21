import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sns_subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";

interface ObservabilityStackProps extends cdk.StackProps {
  ingestHandler: lambda.Function;
  jobProcessor: lambda.Function;
  lambdaRegion: string;
}

export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    // SNS topic for billing alerts — subscribe your email after deploy
    const billingAlertTopic = new sns.Topic(this, "BillingAlertTopic", {
      topicName: "spectra-billing-alerts",
      displayName: "Spectra Billing Alerts",
    });

    // Add email subscription — replace with actual address after CDK bootstrap
    const alertEmail = process.env.BILLING_ALERT_EMAIL ?? "gchiriac2012@gmail.com";
    billingAlertTopic.addSubscription(new sns_subscriptions.EmailSubscription(alertEmail));

    // CloudWatch billing alarm — triggers at $20 estimated monthly charges
    // Note: billing metrics are only available in us-east-1
    const billingAlarm = new cloudwatch.Alarm(this, "BillingAlarm", {
      alarmName: "spectra-monthly-billing-20usd",
      alarmDescription: "Estimated monthly AWS charges exceeded $20",
      metric: new cloudwatch.Metric({
        namespace: "AWS/Billing",
        metricName: "EstimatedCharges",
        dimensionsMap: { Currency: "USD" },
        statistic: "Maximum",
        period: cdk.Duration.hours(6),
        region: "us-east-1",
      }),
      threshold: 20,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    billingAlarm.addAlarmAction(new cw_actions.SnsAction(billingAlertTopic));

    // CloudWatch dashboard for Lambda observability
    const dashboard = new cloudwatch.Dashboard(this, "SpectraDashboard", {
      dashboardName: "spectra-operations",
    });

    const makeInvocationWidget = (fn: lambda.Function, title: string) =>
      new cloudwatch.GraphWidget({
        title: `${title} — Invocations`,
        left: [
          fn.metricInvocations({
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            region: props.lambdaRegion,
          }),
        ],
        right: [
          fn.metricErrors({
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            region: props.lambdaRegion,
          }),
        ],
        width: 12,
      });

    const makeDurationWidget = (fn: lambda.Function, title: string) =>
      new cloudwatch.GraphWidget({
        title: `${title} — Duration (ms)`,
        left: [
          fn.metricDuration({
            statistic: "Average",
            period: cdk.Duration.minutes(5),
            region: props.lambdaRegion,
          }),
          fn.metricDuration({
            statistic: "p99",
            period: cdk.Duration.minutes(5),
            region: props.lambdaRegion,
          }),
        ],
        width: 12,
      });

    dashboard.addWidgets(
      makeInvocationWidget(props.ingestHandler, "ingestHandler"),
      makeInvocationWidget(props.jobProcessor, "jobProcessor"),
    );

    dashboard.addWidgets(
      makeDurationWidget(props.ingestHandler, "ingestHandler"),
      makeDurationWidget(props.jobProcessor, "jobProcessor"),
    );

    new cdk.CfnOutput(this, "DashboardUrl", {
      value: `https://${props.env?.region ?? "eu-west-1"}.console.aws.amazon.com/cloudwatch/home#dashboards:name=spectra-operations`,
      description: "CloudWatch dashboard URL",
    });
  }
}
