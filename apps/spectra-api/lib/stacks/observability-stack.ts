import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sns_subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";

interface ObservabilityStackProps extends cdk.StackProps {
  ingestHandler: lambda.Function;
  jobProcessor: lambda.Function;
  /** Pre-created LogGroup for ingestHandler — passed from ComputeStack to avoid cross-region lookup. */
  ingestHandlerLogGroup: logs.ILogGroup;
  /** Pre-created LogGroup for jobProcessor — passed from ComputeStack to avoid cross-region lookup. */
  jobProcessorLogGroup: logs.ILogGroup;
  lambdaRegion: string;
}

export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    // SNS topic for Lambda error alerts — email subscribed after deploy.
    // This stack is deployed to eu-west-1 alongside the Lambdas.
    // Billing alerts ($15 threshold) live in BillingAlarmStack (us-east-1)
    // because EstimatedCharges metrics only exist in us-east-1.
    const errorAlertTopic = new sns.Topic(this, "LambdaErrorAlertTopic", {
      topicName: "spectra-lambda-errors",
      displayName: "Spectra Lambda Error Alerts",
    });

    const alertEmail = process.env.BILLING_ALERT_EMAIL ?? "gchiriac2012@gmail.com";
    errorAlertTopic.addSubscription(new sns_subscriptions.EmailSubscription(alertEmail));

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

    // MetricFilters watch each Lambda log group for [ERROR] lines and increment
    // a custom metric. Alarms on those metrics fire to the error SNS topic so
    // any Lambda error in production triggers an email notification.
    //
    // The LogGroup constructs are passed from ComputeStack via props. Using
    // LogGroup.fromLogGroupName() caused a "log group does not exist" error
    // because that API performs a live CloudFormation lookup — if the stack is
    // fresh (or was deleted and re-created) the group hasn't been created yet.
    // Passing the construct reference directly resolves the dependency correctly.
    const makeErrorFilter = (
      fn: lambda.Function,
      logGroup: logs.ILogGroup,
      id: string,
    ) => {
      const metricName = `${id}ErrorCount`;
      new logs.MetricFilter(this, `${id}ErrorFilter`, {
        logGroup,
        metricNamespace: "Spectra/Lambda",
        metricName,
        filterPattern: logs.FilterPattern.anyTerm("[ERROR]", "ERROR", "Unhandled"),
        metricValue: "1",
        defaultValue: 0,
        unit: cloudwatch.Unit.COUNT,
      });
      const alarm = new cloudwatch.Alarm(this, `${id}ErrorAlarm`, {
        alarmName: `spectra-${id.toLowerCase()}-errors`,
        alarmDescription: `${fn.functionName} is logging errors`,
        metric: new cloudwatch.Metric({
          namespace: "Spectra/Lambda",
          metricName,
          statistic: "Sum",
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      alarm.addAlarmAction(new cw_actions.SnsAction(errorAlertTopic));
    };

    makeErrorFilter(props.ingestHandler, props.ingestHandlerLogGroup, "IngestHandler");
    makeErrorFilter(props.jobProcessor, props.jobProcessorLogGroup, "JobProcessor");

    new cdk.CfnOutput(this, "DashboardUrl", {
      value: `https://${props.env?.region ?? "eu-west-1"}.console.aws.amazon.com/cloudwatch/home#dashboards:name=spectra-operations`,
      description: "CloudWatch dashboard URL",
    });
  }
}
