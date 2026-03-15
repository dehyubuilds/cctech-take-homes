import {
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, getTable } from "@/lib/dynamodb";
import type { Subscription, SubscriptionStopEntry } from "@/lib/domain";

const SUBS_TABLE = () => getTable("subscriptions");
const STOP_TABLE = () => getTable("subscriptionStop");

export function getDynamoSubscriptionRepository() {
  return {
    async getByUserAndApp(
      userId: string,
      appId: string
    ): Promise<Subscription | null> {
      const { Items } = await docClient.send(
        new QueryCommand({
          TableName: SUBS_TABLE(),
          IndexName: "user-app-index",
          KeyConditionExpression: "userId = :uid AND appId = :aid",
          ExpressionAttributeValues: { ":uid": userId, ":aid": appId },
          Limit: 1,
        })
      );
      const sub = Items?.[0] as Subscription | undefined;
      return sub?.status === "active" ? sub : null;
    },

    async listByUser(userId: string): Promise<Subscription[]> {
      const { Items } = await docClient.send(
        new QueryCommand({
          TableName: SUBS_TABLE(),
          IndexName: "user-app-index",
          KeyConditionExpression: "userId = :uid",
          ExpressionAttributeValues: { ":uid": userId },
        })
      );
      return (Items as Subscription[]) ?? [];
    },

    async listByApp(appId: string): Promise<Subscription[]> {
      const { Items } = await docClient.send(
        new QueryCommand({
          TableName: SUBS_TABLE(),
          IndexName: "app-index",
          KeyConditionExpression: "appId = :aid",
          FilterExpression: "#st = :active",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: { ":aid": appId, ":active": "active" },
        })
      );
      return (Items as Subscription[]) ?? [];
    },

    async listByAppAll(appId: string): Promise<Subscription[]> {
      const { Items } = await docClient.send(
        new QueryCommand({
          TableName: SUBS_TABLE(),
          IndexName: "app-index",
          KeyConditionExpression: "appId = :aid",
          ExpressionAttributeValues: { ":aid": appId },
        })
      );
      return (Items as Subscription[]) ?? [];
    },

    async create(sub: Subscription): Promise<Subscription> {
      await docClient.send(
        new PutCommand({
          TableName: SUBS_TABLE(),
          Item: sub,
        })
      );
      return sub;
    },

    async update(
      subscriptionId: string,
      patch: Partial<Subscription>
    ): Promise<Subscription | null> {
      const now = new Date().toISOString();
      const updates: string[] = ["updatedAt = :now"];
      const names: Record<string, string> = {};
      const values: Record<string, unknown> = { ":now": now };
      if (patch.status !== undefined) {
        names["#st"] = "status";
        values[":st"] = patch.status;
        updates.push("#st = :st");
      }
      const { Attributes } = await docClient.send(
        new UpdateCommand({
          TableName: SUBS_TABLE(),
          Key: { subscriptionId },
          UpdateExpression: "SET " + updates.join(", "),
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        })
      );
      return (Attributes as Subscription) ?? null;
    },

    async cancel(subscriptionId: string): Promise<boolean> {
      const updated = await this.update(subscriptionId, {
        status: "canceled",
      });
      return !!updated;
    },

    async pauseAllForApp(appId: string): Promise<number> {
      const list = await this.listByApp(appId);
      const now = new Date().toISOString();
      for (const s of list) {
        await this.update(s.subscriptionId, { status: "paused" });
      }
      return list.length;
    },

    async writeSubscriptionStopEntry(
      appId: string
    ): Promise<SubscriptionStopEntry> {
      const now = new Date().toISOString();
      const entry: SubscriptionStopEntry = {
        entryId: `stop-${appId}-${Date.now()}`,
        appId,
        reason: "app_disabled",
        createdAt: now,
      };
      await docClient.send(
        new PutCommand({
          TableName: STOP_TABLE(),
          Item: { ...entry, pk: appId, sk: entry.entryId },
        })
      );
      return entry;
    },

    async hasSubscriptionStopEntry(appId: string): Promise<boolean> {
      const { Items } = await docClient.send(
        new QueryCommand({
          TableName: STOP_TABLE(),
          KeyConditionExpression: "pk = :appId",
          ExpressionAttributeValues: { ":appId": appId },
          Limit: 1,
        })
      );
      return (Items?.length ?? 0) > 0;
    },
  };
}
