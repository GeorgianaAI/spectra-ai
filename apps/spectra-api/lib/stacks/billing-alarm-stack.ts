import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sns_subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";

/**
 * BillingAlarmStack — MUST be deployed to us-east-1.
 *
 * AWS/Billing EstimatedCharges metrics are only published in us-east-1.
 * CDK (and CloudFormation) enforce that a cloudwatch.Alarm must live in the
 * same region as its metric, so this stack cannot share a region with
 * ObservabilityStack (eu-west-1).
 */
export class BillingAlarmStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // SNS topic for billing alerts — subscribe your email after deploy.
    // AWS will send a confirmation email; click it or alarms won't notify you.
    const billingAlertTopic = new sns.Topic(this, "BillingAlertTopic", {
      topicName: "spectra-billing-alerts",
      displayName: "Spectra Billing Alerts",
    });

    const alertEmail = process.env.BILLING_ALERT_EMAIL ?? "gchiriac2012@gmail.com";
    billingAlertTopic.addSubscription(new sns_subscriptions.EmailSubscription(alertEmail));

    // CloudWatch billing alarm — triggers at $15 estimated monthly charges.
    // EstimatedCharges is only available in us-east-1 (AWS limitation).
    const billingAlarm = new cloudwatch.Alarm(this, "BillingAlarm", {
      alarmName: "spectra-monthly-billing-15usd",
      alarmDescription: "Estimated monthly AWS charges exceeded $15",
      metric: new cloudwatch.Metric({
        namespace: "AWS/Billing",
        metricName: "EstimatedCharges",
        dimensionsMap: { Currency: "USD" },
        statistic: "Maximum",
        period: cdk.Duration.hours(6),
      }),
      threshold: 15,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    billingAlarm.addAlarmAction(new cw_actions.SnsAction(billingAlertTopic));

    new cdk.CfnOutput(this, "BillingAlarmArn", {
      value: billingAlarm.alarmArn,
      description: "Billing alarm ARN (us-east-1)",
    });
  }
}
