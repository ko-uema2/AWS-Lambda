import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class ReportDbTagsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const executionLambdaRole = new cdk.aws_iam.Role(
      this,
      "executionLambdaRole",
      {
        roleName: "reportDBTags-executionRole",
        assumedBy: new cdk.aws_iam.ServicePrincipal("lambda.amazonaws.com"),
        managedPolicies: [
          cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
            "AmazonSSMReadOnlyAccess"
          ),
          cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
            "CloudWatchLogsFullAccess"
          ),
        ],
      }
    );

    const lambda = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "main-handler",
      {
        runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
        entry: "lambda/handler.ts",
        role: executionLambdaRole,
        environment: {
          NOTION_AUTH: "reportDBTags-notionAuth",
          NOTION_READ_DB_ID: "reportDBTags-notionReadDBId",
          NOTION_WRITE_DB_ID: "reportDBTags-notionWriteDBId",
        },
        timeout: cdk.Duration.seconds(360),
      }
    );

    new cdk.aws_events.Rule(this, "Schedule", {
      schedule: cdk.aws_events.Schedule.expression("cron(0 23 ? * SUN *)"),
      targets: [new cdk.aws_events_targets.LambdaFunction(lambda)],
    });
  }
}
