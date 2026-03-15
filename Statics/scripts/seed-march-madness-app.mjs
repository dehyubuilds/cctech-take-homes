#!/usr/bin/env node
/**
 * Insert the March Madness app into DynamoDB so it appears on the dashboard.
 * Run after deploy-statics-infra and before or after first login.
 * Requires: AWS_REGION, STATICS_APPS_TABLE in env (from .env.local or export).
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-1";
const table = process.env.STATICS_APPS_TABLE || "statics_apps";

const marchMadnessApp = {
  appId: "app-march-madness",
  name: "Daily March Madness Picks",
  slug: "daily-march-madness-picks",
  description:
    "Get daily SMS picks for March Madness: game analysis, betting edges, and short explanations. One text per day during the tournament.",
  thumbnailUrl: "https://placehold.co/400x225/1a1a1a/6366f1?text=March+Madness",
  siteUrl: "/app/daily-march-madness-picks",
  status: "active",
  priceCents: 0,
  shareTitle: "Daily March Madness Picks | Statics",
  shareDescription: "Daily SMS picks for March Madness: game analysis and betting edges.",
  shareImageUrl: "https://placehold.co/1200x630/1a1a1a/6366f1?text=Daily+March+Madness+Picks",
  canonicalUrl: "https://statics.example.com/apps/daily-march-madness-picks",
  createdBy: "admin",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const client = new DynamoDBClient({ region });
const doc = DynamoDBDocumentClient.from(client);

await doc.send(
  new PutCommand({
    TableName: table,
    Item: marchMadnessApp,
  })
);

console.log("Seeded March Madness app into", table);
