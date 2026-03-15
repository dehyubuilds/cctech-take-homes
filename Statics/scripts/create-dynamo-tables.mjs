#!/usr/bin/env node
/**
 * Create DynamoDB tables for Statics. Idempotent (skips if exists).
 * Usage: node scripts/create-dynamo-tables.mjs
 * Creates: users, apps, subscriptions, subscription_stop, verify (phone 2FA codes).
 * Optional: enable TTL on verify table for attribute "ttl" to auto-delete expired codes.
 */
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";

const region = process.env.AWS_REGION || "us-east-1";
const prefix = process.env.STATICS_INFRA_PREFIX || "statics";

const tables = {
  users: {
    TableName: `${prefix}_users`,
    KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "email", AttributeType: "S" },
      { AttributeName: "phoneNormalized", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      { IndexName: "email-index", KeySchema: [{ AttributeName: "email", KeyType: "HASH" }], Projection: { ProjectionType: "ALL" } },
      { IndexName: "phone-index", KeySchema: [{ AttributeName: "phoneNormalized", KeyType: "HASH" }], Projection: { ProjectionType: "ALL" } },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  apps: {
    TableName: `${prefix}_apps`,
    KeySchema: [{ AttributeName: "appId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "appId", AttributeType: "S" },
      { AttributeName: "slug", AttributeType: "S" },
      { AttributeName: "status", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      { IndexName: "slug-index", KeySchema: [{ AttributeName: "slug", KeyType: "HASH" }], Projection: { ProjectionType: "ALL" } },
      { IndexName: "status-index", KeySchema: [{ AttributeName: "status", KeyType: "HASH" }], Projection: { ProjectionType: "ALL" } },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  subscriptions: {
    TableName: `${prefix}_subscriptions`,
    KeySchema: [{ AttributeName: "subscriptionId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "subscriptionId", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "appId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      { IndexName: "user-app-index", KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }, { AttributeName: "appId", KeyType: "RANGE" }], Projection: { ProjectionType: "ALL" } },
      { IndexName: "app-index", KeySchema: [{ AttributeName: "appId", KeyType: "HASH" }], Projection: { ProjectionType: "ALL" } },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  subscriptionStop: {
    TableName: `${prefix}_subscription_stop`,
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  verify: {
    TableName: `${prefix}_verify`,
    KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "userId", AttributeType: "S" }],
    BillingMode: "PAY_PER_REQUEST",
  },
};

const client = new DynamoDBClient({ region });

async function tableExists(name) {
  try {
    await client.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch {
    return false;
  }
}

for (const [label, spec] of Object.entries(tables)) {
  const name = spec.TableName;
  if (await tableExists(name)) {
    console.log(`Table ${name} already exists.`);
    continue;
  }
  await client.send(new CreateTableCommand(spec));
  console.log(`Created table ${name}.`);
}

console.log("DynamoDB tables ready.");
console.log("STATICS_USERS_TABLE=" + tables.users.TableName);
console.log("STATICS_APPS_TABLE=" + tables.apps.TableName);
console.log("STATICS_SUBSCRIPTIONS_TABLE=" + tables.subscriptions.TableName);
console.log("STATICS_SUBSCRIPTION_STOP_TABLE=" + tables.subscriptionStop.TableName);
console.log("STATICS_VERIFY_TABLE=" + tables.verify.TableName);
