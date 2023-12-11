import { GetParametersCommand, SSMClient } from "@aws-sdk/client-ssm";
import { Client } from "@notionhq/client";
import { Context, ScheduledEvent } from "aws-lambda";
import { SelectPropertyResponse, WriteDataType } from "./type/notion.type";

const NOTION_AUTH_KEY = process.env["NOTION_AUTH"]!;
const NOTION_READ_DB_ID_KEY = process.env["NOTION_READ_DB_ID"]!;
const NOTION_WRITE_DB_ID_KEY = process.env["NOTION_WRITE_DB_ID"]!;
const NOTION_PROPERTY_NAME = "Tags";

export const handler = async (event: ScheduledEvent, context: Context) => {
  try {
    console.log("- start - handler");
    const { notionAuth, notionReadDBId, notionWriteDBId } =
      await getParametersFromSSM();

    if (!notionAuth || !notionReadDBId || !notionWriteDBId) {
      throw new Error("必要な情報を全て取得できませんでした");
    }

    // notionClientをインスタンス化
    const notionClient = new Client({ auth: notionAuth });

    // プロパティ「Tags」オプジェクトを取得
    const multiSelectProperty = await readDBTags(notionClient, notionReadDBId);

    if (multiSelectProperty && multiSelectProperty.type === "multi_select") {
      console.log(multiSelectProperty.multi_select.options.length);
      // プロパティ「Tags」オブジェクトから設定された各種Tagを1つずつ処理
      for (const tagInfo of multiSelectProperty.multi_select.options) {
        // Tagを検索キーにデータベース内を検索
        const usedNumber = await reportDB(
          tagInfo,
          notionClient,
          notionReadDBId
        );

        const writeData = {
          tagName: tagInfo.name,
          usedNumber,
        };

        // Tag名称と利用回数をデータベースに書き込み
        await writeDB(writeData, notionClient, notionWriteDBId);
      }
      console.log("- end - handler");
    } else {
      throw new Error(
        `プロパティ '${NOTION_PROPERTY_NAME} 'がマルチセレクトではありません`
      );
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("エラーが発生しました", error);
    }
  }
};

const getParametersFromSSM = async () => {
  console.log("- start - getParametersFromSSM");
  const ssm = new SSMClient({ region: "ap-northeast-1" });

  const secureStrResponse = await ssm.send(
    new GetParametersCommand({
      Names: [NOTION_AUTH_KEY, NOTION_READ_DB_ID_KEY, NOTION_WRITE_DB_ID_KEY],
      WithDecryption: true,
    })
  );

  console.log("- end - getParametersFromSSM");

  return {
    notionAuth: secureStrResponse.Parameters?.find(
      (p) => p.Name === NOTION_AUTH_KEY
    )?.Value,

    notionReadDBId: secureStrResponse.Parameters?.find(
      (p) => p.Name === NOTION_READ_DB_ID_KEY
    )?.Value,

    notionWriteDBId: secureStrResponse.Parameters?.find(
      (p) => p.Name === NOTION_WRITE_DB_ID_KEY
    )?.Value,
  };
};

const readDBTags = async (notionClient: Client, notionReadDBId: string) => {
  try {
    console.log("- start - readDBTags");
    const response = await notionClient.databases.retrieve({
      database_id: notionReadDBId,
    });

    const multiSelectProperty = response.properties[NOTION_PROPERTY_NAME];

    console.log("- end - readDBTags");
    return multiSelectProperty;
  } catch (error: unknown) {
    throw error;
  }
};

const reportDB = async (
  tagInfo: SelectPropertyResponse,
  notionClient: Client,
  notionReadDBId: string
) => {
  try {
    console.log("- start - reportDB");
    const queryResult = await notionClient.databases.query({
      database_id: notionReadDBId,
      filter: {
        property: NOTION_PROPERTY_NAME,
        multi_select: {
          contains: tagInfo.name,
        },
      },
    });

    const countNumber = queryResult.results.length;

    console.log("- end - reportDB");
    return countNumber;
  } catch (error: unknown) {
    throw error;
  }
};

const writeDB = async (
  writeData: WriteDataType,
  notionClient: Client,
  notionWriteDBId: string
) => {
  try {
    console.log("- start - writeDB");
    await notionClient.pages.create({
      parent: {
        database_id: notionWriteDBId,
      },
      properties: {
        タグ名称: {
          title: [
            {
              type: "text",
              text: {
                content: writeData.tagName,
              },
            },
          ],
        },
        利用数: {
          number: writeData.usedNumber,
        },
      },
    });
    console.log("- end - writeDB");
  } catch (error: unknown) {
    throw error;
  }
};
