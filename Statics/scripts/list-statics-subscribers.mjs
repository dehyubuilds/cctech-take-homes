#!/usr/bin/env node
/**
 * List active subscribers from DynamoDB (statics_subscriptions + statics_users).
 * Run from Statics root: node scripts/list-statics-subscribers.mjs [appId]
 * If appId is omitted, lists all subscriptions with app names.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const config = {
  aws: {
    accessKeyId: process.env.STATICS_AWS_ACCESS_KEY_ID || "AKIASCPOEM7JYLK5BJFR",
    secretAccessKey: process.env.STATICS_AWS_SECRET_ACCESS_KEY || "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",
    region: process.env.STATICS_AWS_REGION || "us-east-1",
  },
  tables: {
    users: "statics_users",
    subscriptions: "statics_subscriptions",
    apps: "statics_apps",
  },
};

const client = new DynamoDBClient({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});
const doc = DynamoDBDocumentClient.from(client);

async function scanTable(tableName, attr) {
  const items = [];
  let lastKey;
  do {
    const res = await doc.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      })
    );
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function getAppName(appId) {
  try {
    const { Item } = await doc.send(
      new GetCommand({
        TableName: config.tables.apps,
        Key: { appId },
      })
    );
    return Item?.name || appId;
  } catch {
    return appId;
  }
}

async function getUserEmail(userId) {
  try {
    const { Item } = await doc.send(
      new GetCommand({
        TableName: config.tables.users,
        Key: { userId },
      })
    );
    return Item?.email || userId;
  } catch {
    return userId;
  }
}

const appIdFilter = process.argv[2]; // optional appId

async function main() {
  const subs = await scanTable(config.tables.subscriptions, "subscriptionId");
  const active = subs.filter((s) => s.status === "active");
  if (active.length === 0) {
    console.log("No active subscriptions in DynamoDB.");
    return;
  }

  const byApp = {};
  for (const s of active) {
    if (appIdFilter && s.appId !== appIdFilter) continue;
    if (!byApp[s.appId]) byApp[s.appId] = [];
    byApp[s.appId].push(s);
  }

  const appIds = Object.keys(byApp);
  for (const appId of appIds) {
    const appName = await getAppName(appId);
    console.log(`\n--- ${appName} (${appId}) ---`);
    const list = byApp[appId];
    for (const sub of list) {
      const email = await getUserEmail(sub.userId);
      console.log(`  ${email}  (userId: ${sub.userId})  ${sub.createdAt || ""}`);
    }
    console.log(`  Total: ${list.length} subscriber(s)`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
