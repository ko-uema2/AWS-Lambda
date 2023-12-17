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

export const handler = async (event: ScheduledEvent, context: Context) => {
  const BEFORE_DAY = 7;
  try {
    const { notionAuth, notionDBId, slackBotToken, slackChannelName } =
      await getParametersFromSSM();

    if (!notionAuth || !notionDBId || !slackBotToken || !slackChannelName) {
      throw new Error("必要な情報を全て取得できませんでした");
    }

    const targetDate = getBeforeDate(event.time, BEFORE_DAY);
    console.log(`date: ${targetDate}`);

    const notionClient = new Client({
      auth: notionAuth,
    });
    const slackClient = new WebClient(slackBotToken);

    const queryResult = await notionClient.databases.query({
      database_id: notionDBId,
      filter: {
        and: [
          {
            property: "完了日",
            date: {
              on_or_after: targetDate,
            },
          },
          {
            property: "done",
            checkbox: {
              equals: true,
            },
          },
        ],
      },
    });
    const memoCount = queryResult.results.length;
    const sendMsg = `先週は \`${memoCount}\` 件も隙間時間にやるべきことを消化した！\n隙間時間によく頑張った！ 感動したﾂ！！`;

    await slackClient.chat.postMessage({
      text: sendMsg,
      channel: slackChannelName!,
      mrkdwn: true,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("エラーが発生しました", error);
    }
  }
};

const getParametersFromSSM = async () => {
  const ssm = new SSMClient({ region: "ap-northeast-1" });
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

const getBeforeDate = (dateStr: string, beforeDay: number): string => {
  const dateObj = new Date(dateStr);
  dateObj.setUTCDate(dateObj.getUTCDate() - beforeDay);

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
  })
    .format(dateObj)
    .replace(/\//g, "-");
};
