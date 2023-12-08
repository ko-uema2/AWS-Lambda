import {
  GetParameterCommand,
  GetParametersCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { Client } from "@notionhq/client";
import { WebClient } from "@slack/web-api";
import { Context, ScheduledEvent } from "aws-lambda";

const NOTION_AUTH_KEY = process.env["NOTION_AUTH"]!;
const NOTION_DB_ID_KEY = process.env["NOTION_DB_ID"]!;
const SLACK_BOT_TOKEN_KEY = process.env["SLACK_BOT_TOKEN"]!;
const SLACK_CHANNEL_NAME_KEY = process.env["SLACK_CHANNEL_NAME"]!;

const ssm = new SSMClient({ region: "ap-northeast-1" });

const getParametersFromSSM = async () => {
  const secureStrResponse = await ssm.send(
    new GetParametersCommand({
      Names: [NOTION_AUTH_KEY, NOTION_DB_ID_KEY, SLACK_BOT_TOKEN_KEY],
      WithDecryption: true,
    })
  );

  const strResponse = await ssm.send(
    new GetParameterCommand({
      Name: SLACK_CHANNEL_NAME_KEY,
      WithDecryption: false,
    })
  );

  return {
    notionAuth: secureStrResponse.Parameters?.find(
      (p) => p.Name === NOTION_AUTH_KEY
    )?.Value,

    notionDBId: secureStrResponse.Parameters?.find(
      (p) => p.Name === NOTION_DB_ID_KEY
    )?.Value,

    slackBotToken: secureStrResponse.Parameters?.find(
      (p) => p.Name === SLACK_BOT_TOKEN_KEY
    )?.Value,

    slackChannelName: strResponse.Parameter?.Value,
  };
};

export const handler = async (event: ScheduledEvent, context: Context) => {
  try {
    const { notionAuth, notionDBId, slackBotToken, slackChannelName } =
      await getParametersFromSSM();

    if (!notionAuth || !notionDBId || !slackBotToken || !slackChannelName) {
      throw new Error("必要な情報を全て取得できませんでした");
    }

    const notionClient = new Client({
      auth: notionAuth,
    });
    const slackClient = new WebClient(slackBotToken);

    const queryResult = await notionClient.databases.query({
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

    await slackClient.chat.postMessage({
      text: memoCount,
      channel: slackChannelName!,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("エラーが発生しました", error);
    }
  }
};
