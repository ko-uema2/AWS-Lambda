import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class CountAndNotifyNotionPagesToSlackStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const executionLambdaRole = new cdk.aws_iam.Role(
      this,
      "executionLambdaRole",
      {
        roleName: "countAndNotifyNotionPagesToSlack-executionRole",
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

    // 実行するlambda関数の環境設定
    const lambda = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "main-handler",
      {
        runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
        entry: "lambda/handler.ts",
        role: executionLambdaRole,
        environment: {
          NOTION_AUTH: "countAndNotifyNotionPagesToSlack-notionAuth",
          NOTION_DB_ID: "countAndNotifyNotionPagesToSlack-notionDBId",
          SLACK_BOT_TOKEN: "countAndNotifyNotionPagesToSlack-slackBotToken",
          SLACK_CHANNEL_NAME: "countAndNotifyNotionPagesToSlack-channelName",
        },
        timeout: cdk.Duration.seconds(30),
      }
    );

    // EventBridgeでlambdaを定期実行
    // 試験的に5分毎に実行するように設定
    new cdk.aws_events.Rule(this, "Schedule", {
      schedule: cdk.aws_events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new cdk.aws_events_targets.LambdaFunction(lambda)],
    });
  }
}
