import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, getTable } from "@/lib/dynamodb";
import type { App } from "@/lib/domain";

const APPS_TABLE = () => getTable("apps");

export function getDynamoAppRepository() {
  return {
    async list(status?: App["status"]): Promise<App[]> {
      let items: App[];
      if (status) {
        const { Items } = await docClient.send(
          new QueryCommand({
            TableName: APPS_TABLE(),
            IndexName: "status-index",
            KeyConditionExpression: "#st = :st",
            ExpressionAttributeNames: { "#st": "status" },
            ExpressionAttributeValues: { ":st": status },
          })
        );
        items = (Items as App[]) ?? [];
      } else {
        const { Items } = await docClient.send(
          new ScanCommand({ TableName: APPS_TABLE() })
        );
        items = (Items as App[]) ?? [];
      }
      return items.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    },

    async getById(appId: string): Promise<App | null> {
      const { Item } = await docClient.send(
        new GetCommand({
          TableName: APPS_TABLE(),
          Key: { appId },
        })
      );
      return (Item as App) ?? null;
    },

    async getBySlug(slug: string): Promise<App | null> {
      const { Items } = await docClient.send(
        new QueryCommand({
          TableName: APPS_TABLE(),
          IndexName: "slug-index",
          KeyConditionExpression: "slug = :slug",
          ExpressionAttributeValues: { ":slug": slug },
        })
      );
      return (Items?.[0] as App) ?? null;
    },

    async create(app: App): Promise<App> {
      await docClient.send(
        new PutCommand({
          TableName: APPS_TABLE(),
          Item: app,
        })
      );
      return app;
    },

    async update(appId: string, patch: Partial<App>): Promise<App | null> {
      const now = new Date().toISOString();
      const updates: string[] = ["updatedAt = :now"];
      const names: Record<string, string> = {};
      const values: Record<string, unknown> = { ":now": now };

      const allowed = [
        "name",
        "slug",
        "description",
        "thumbnailUrl",
        "siteUrl",
        "status",
        "priceCents",
        "shareTitle",
        "shareDescription",
        "shareImageUrl",
        "canonicalUrl",
      ] as const;
      for (const k of allowed) {
        if (patch[k] !== undefined) {
          names[`#${k}`] = k;
          values[`:${k}`] = patch[k];
          updates.push(`#${k} = :${k}`);
        }
      }
      if (updates.length === 1) return this.getById(appId);

      const { Attributes } = await docClient.send(
        new UpdateCommand({
          TableName: APPS_TABLE(),
          Key: { appId },
          UpdateExpression: "SET " + updates.join(", "),
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        })
      );
      return (Attributes as App) ?? null;
    },

    async delete(appId: string): Promise<boolean> {
      const { Attributes } = await docClient.send(
        new DeleteCommand({
          TableName: APPS_TABLE(),
          Key: { appId },
          ReturnValues: "ALL_OLD",
        })
      );
      return !!Attributes;
    },
  };
}
