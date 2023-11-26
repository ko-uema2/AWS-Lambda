import { GetParametersCommand, SSMClient } from "@aws-sdk/client-ssm";
import { Client } from "@notionhq/client";
import { WebClient } from "@slack/web-api";
import { Context, ScheduledEvent } from "aws-lambda";

export const handler = async (event: ScheduledEvent, context: Context) => {
  const ssm = new SSMClient({ region: "ap-northeast-1" });
  const ssmParams = {
    Names: [
      process.env["NOTION_AUTH"]!,
      process.env["NOTION_DB_ID"]!,
      process.env["SLACK_BOT_TOKEN"]!,
    ],
    WithDecryption: true,
  };
  const command = new GetParametersCommand(ssmParams);

  let notionClient: Client | null = null;
  let notionDBId: string | undefined;
  let slackClient: WebClient | null = null;

  try {
    const response = await ssm.send(command);
    if (!response) {
      throw new Error("認証情報の取得に失敗");
    }

    response.Parameters?.forEach((param) => {
      switch (param.Name) {
        case "countAndNotifyNotionPagesToSlack-notionAuth":
          notionClient = new Client({
            auth: param.Value,
          });
          break;

        case "countAndNotifyNotionPagesToSlack-notionDBId":
          notionDBId = param.Value;
          break;

        case "countAndNotifyNotionPagesToSlack-slackBotToken":
          slackClient = new WebClient(param.Value);
          break;

        default:
          throw new Error("想定外の情報を取得しました");
      }
    });

    if (!notionClient) {
      throw new Error("notionClientの情報を取得できていません");
    }

    if (!notionDBId) {
      throw new Error("notionDBIdの情報を取得できていません");
    }

    if (!slackClient) {
      throw new Error("slackClientの情報を取得できていません");
    }

    const notion = notionClient as Client;
    const slack = slackClient as WebClient;

    const queryResult = await notion.databases.query({
      database_id: notionDBId,
      filter: {
        and: [
          {
            property: "GoodNotes",
            status: {
              equals: "メモあり",
            },
          },
          {
            property: "done",
            checkbox: {
              equals: false,
            },
          },
        ],
      },
    });
    const memoCount = queryResult.results.length.toString();

    slack.chat.postMessage({
      text: memoCount,
      channel: process.env["SLACK_CHANNEL_NAME"]!,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log(error);
    }
  }
};
