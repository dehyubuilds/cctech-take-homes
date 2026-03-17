#!/usr/bin/env node
/**
 * Who gets the March Madness daily text tomorrow (8 AM UTC)?
 * Queries DynamoDB the same way as GET /api/products/march-madness/allowed-numbers.
 * Run from Statics root: node scripts/who-gets-march-madness-text.mjs
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
    accessKeyId: "AKIASCPOEM7JYLK5BJFR",
    secretAccessKey: "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",
    region: "us-east-1",
  },
  tables: {
    users: "statics_users",
    subscriptions: "statics_subscriptions",
    apps: "statics_apps",
  },
};

function toE164(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10 && !String(phone).trim().startsWith("+")) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return String(phone).trim().startsWith("+") ? String(phone).trim() : `+${digits}`;
}

const client = new DynamoDBClient({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});
const doc = DynamoDBDocumentClient.from(client);

async function main() {
  // 1) Get app by slug daily-march-madness-picks (slug-index)
  let app = null;
  const appScan = await doc.send(
    new ScanCommand({
      TableName: config.tables.apps,
      FilterExpression: "#s = :slug",
      ExpressionAttributeNames: { "#s": "slug" },
      ExpressionAttributeValues: { ":slug": "daily-march-madness-picks" },
    })
  );
  if (appScan.Items && appScan.Items.length > 0) app = appScan.Items[0];
  if (!app) {
    console.log("No app with slug 'daily-march-madness-picks' in DynamoDB. Nobody gets a text.");
    return;
  }
  const appId = app.appId;
  const appName = app.name || appId;

  // 2) List subscriptions for this app (app-index: appId)
  const subRes = await doc.send(
    new QueryCommand({
      TableName: config.tables.subscriptions,
      IndexName: "app-index",
      KeyConditionExpression: "appId = :aid",
      ExpressionAttributeValues: { ":aid": appId },
    })
  );
  const subs = (subRes.Items || []).filter((s) => s.status === "active");
  if (subs.length === 0) {
    console.log(`App "${appName}" has 0 active subscriptions. Nobody gets a text tomorrow.`);
    return;
  }

  // 3) For each subscriber, get user; include only if smsStatus === "active" and phoneNumber set
  const recipients = [];
  for (const sub of subs) {
    const u = await doc.send(
      new GetCommand({
        TableName: config.tables.users,
        Key: { userId: sub.userId },
      })
    );
    const user = u.Item;
    if (!user || user.smsStatus !== "active") continue;
    if (!user.phoneNumber || !String(user.phoneNumber).trim()) continue;
    recipients.push({
      email: user.email || sub.userId,
      phone: toE164(user.phoneNumber),
      userId: sub.userId,
      phoneVerified: !!user.phoneVerified,
    });
  }

  console.log("Who gets a text tomorrow at 8 AM UTC (March Madness daily run):\n");
  console.log(`App: ${appName} (${appId})`);
  console.log(`Active subscriptions in DB: ${subs.length}`);
  console.log(`Recipients (subscribed + smsStatus active + phone set): ${recipients.length}\n`);
  if (recipients.length === 0) {
    console.log("No recipients. (All subscribers are either opted out or missing phone number.)");
    return;
  }
  recipients.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.email}  ${r.phone}  (verified: ${r.phoneVerified})`);
  });
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
