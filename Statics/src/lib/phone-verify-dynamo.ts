/**
 * DynamoDB-backed phone verification code store.
 * Use when STATICS_VERIFY_TABLE is set so 2FA works across multiple app instances.
 * Table: PK userId (string), attributes code (string), expiresAt (number), ttl (number, optional for TTL).
 */
import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/dynamodb";
import { config } from "@/lib/config";

const TABLE = () => config.dynamo.tables.verify;

export function isDynamoVerifyConfigured(): boolean {
  return !!config.dynamo.useReal && !!TABLE();
}

export async function setPendingCodeAsync(
  userId: string,
  code: string,
  expiresAt: number
): Promise<void> {
  const table = TABLE();
  if (!table) return;
  await docClient.send(
    new PutCommand({
      TableName: table,
      Item: {
        userId,
        code,
        expiresAt,
        ttl: Math.floor(expiresAt / 1000), // Dynamo TTL in seconds
      },
    })
  );
}

export async function getPendingCodeAsync(
  userId: string
): Promise<{ code: string; expiresAt: number } | null> {
  const table = TABLE();
  if (!table) return null;
  const { Item } = await docClient.send(
    new GetCommand({
      TableName: table,
      Key: { userId },
    })
  );
  if (!Item) return null;
  const expiresAt = Item.expiresAt as number;
  if (Date.now() > expiresAt) {
    await clearPendingCodeAsync(userId);
    return null;
  }
  return { code: Item.code as string, expiresAt };
}

export async function clearPendingCodeAsync(userId: string): Promise<void> {
  const table = TABLE();
  if (!table) return;
  await docClient.send(
    new DeleteCommand({
      TableName: table,
      Key: { userId },
    })
  );
}
