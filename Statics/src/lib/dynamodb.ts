import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { config } from "@/lib/config";

const client = new DynamoDBClient({ region: config.dynamo.region });
export const docClient = DynamoDBDocumentClient.from(client);

export function getTable(name: keyof typeof config.dynamo.tables): string {
  const table = config.dynamo.tables[name];
  if (!table) throw new Error(`Missing DynamoDB table config: ${name}`);
  return table;
}
