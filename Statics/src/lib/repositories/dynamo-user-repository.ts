import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, getTable } from "@/lib/dynamodb";
import type { User } from "@/lib/domain";

const USERS_TABLE = () => getTable("users");

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function getDynamoUserRepository() {
  return {
    async getById(userId: string): Promise<User | null> {
      const { Item } = await docClient.send(
        new GetCommand({
          TableName: USERS_TABLE(),
          Key: { userId },
        })
      );
      return (Item as User) ?? null;
    },

    async getByEmail(email: string): Promise<User | null> {
      const { Items } = await docClient.send(
        new QueryCommand({
          TableName: USERS_TABLE(),
          IndexName: "email-index",
          KeyConditionExpression: "email = :email",
          ExpressionAttributeValues: { ":email": email.toLowerCase() },
        })
      );
      return (Items?.[0] as User) ?? null;
    },

    async getByPhone(phone: string): Promise<User | null> {
      const normalized = normalizePhone(phone);
      const { Items } = await docClient.send(
        new QueryCommand({
          TableName: USERS_TABLE(),
          IndexName: "phone-index",
          KeyConditionExpression: "phoneNormalized = :p",
          ExpressionAttributeValues: { ":p": normalized },
        })
      );
      return (Items?.[0] as User) ?? null;
    },

    /** All users with this phone (for duplicate-verified check). */
    async listByPhone(phone: string): Promise<User[]> {
      const normalized = normalizePhone(phone);
      const { Items } = await docClient.send(
        new QueryCommand({
          TableName: USERS_TABLE(),
          IndexName: "phone-index",
          KeyConditionExpression: "phoneNormalized = :p",
          ExpressionAttributeValues: { ":p": normalized },
        })
      );
      return (Items as User[]) ?? [];
    },

    async list(): Promise<User[]> {
      const { Items } = await docClient.send(
        new ScanCommand({ TableName: USERS_TABLE() })
      );
      return (Items as User[]) ?? [];
    },

    async update(userId: string, patch: Partial<User>): Promise<User | null> {
      const now = new Date().toISOString();
      const setUpdates: string[] = ["updatedAt = :now"];
      const names: Record<string, string> = {};
      const values: Record<string, unknown> = { ":now": now };
      const removeKeys: string[] = [];

      if (patch.phoneNumber !== undefined && patch.phoneNumber) {
        names["#phoneNormalized"] = "phoneNormalized";
        values[":phoneNormalized"] = normalizePhone(patch.phoneNumber);
        setUpdates.push("#phoneNormalized = :phoneNormalized");
      }
      const allowed = [
        "email",
        "phoneNumber",
        "phoneVerified",
        "role",
        "smsStatus",
        "avatarUrl",
        "verifyCode",
        "verifyCodeExpiresAt",
      ] as const;
      for (const k of allowed) {
        if (patch[k] === undefined && (k !== "verifyCode" && k !== "verifyCodeExpiresAt")) continue;
        if ((k === "verifyCode" || k === "verifyCodeExpiresAt") && (patch[k] === undefined || patch[k] === null)) {
          removeKeys.push(k);
          names[`#${k}`] = k;
          continue;
        }
        if (patch[k] === undefined) continue;
        names[`#${k}`] = k;
        values[`:${k}`] = patch[k];
        setUpdates.push(`#${k} = :${k}`);
      }
      if (setUpdates.length === 1 && removeKeys.length === 0) return this.getById(userId);

      const setExpr = "SET " + setUpdates.join(", ");
      const removeExpr = removeKeys.length ? " REMOVE " + removeKeys.map((k) => "#" + k).join(", ") : "";
      const { Attributes } = await docClient.send(
        new UpdateCommand({
          TableName: USERS_TABLE(),
          Key: { userId },
          UpdateExpression: setExpr + removeExpr,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: Object.keys(values).length ? values : undefined,
          ReturnValues: "ALL_NEW",
        })
      );
      return (Attributes as User) ?? null;
    },

    async create(user: User): Promise<User> {
      const item: Record<string, unknown> = { ...user };
      if (user.phoneNumber) {
        item.phoneNormalized = normalizePhone(user.phoneNumber);
      }
      await docClient.send(
        new PutCommand({
          TableName: USERS_TABLE(),
          Item: item,
        })
      );
      return user;
    },
  };
}
