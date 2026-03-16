#!/usr/bin/env node
/**
 * Full reset: remove ALL users from Statics Cognito User Pool and ALL user/subscription
 * (and verify) data from DynamoDB. Use for end-to-end testing from scratch.
 *
 * Run from Statics repo root: node scripts/reset-statics-all-users.mjs
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminDeleteUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const config = {
  aws: {
    accessKeyId: "AKIASCPOEM7JYLK5BJFR",
    secretAccessKey: "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",
    region: "us-east-1",
  },
  tables: {
    users: "statics_users",
    subscriptions: "statics_subscriptions",
    verify: "statics_verify",
  },
  cognito: {
    userPoolId: "us-east-1_slQDFliti",
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
const cognito = new CognitoIdentityProviderClient({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

async function deleteAllCognitoUsers() {
  console.log("Listing and deleting all users in Cognito User Pool...");
  let token;
  let total = 0;
  do {
    const res = await cognito.send(
      new ListUsersCommand({
        UserPoolId: config.cognito.userPoolId,
        Limit: 60,
        PaginationToken: token,
      })
    );
    for (const u of res.Users || []) {
      await cognito.send(
        new AdminDeleteUserCommand({
          UserPoolId: config.cognito.userPoolId,
          Username: u.Username,
        })
      );
      const email = u.Attributes?.find((a) => a.Name === "email")?.Value ?? u.Username;
      console.log("  Deleted Cognito user:", email);
      total++;
    }
    token = res.PaginationToken;
  } while (token);
  console.log("Cognito: deleted", total, "users.");
}

async function deleteAllFromTable(tableName, keyName, label) {
  console.log("Scanning and deleting all", label, "...");
  let total = 0;
  let lastKey;
  do {
    const res = await doc.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      })
    );
    for (const item of res.Items || []) {
      const keyVal = item[keyName];
      if (!keyVal) continue;
      await doc.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { [keyName]: keyVal },
        })
      );
      total++;
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  console.log(label + ":", "deleted", total, "items.");
}

async function main() {
  await deleteAllCognitoUsers();
  await deleteAllFromTable(config.tables.subscriptions, "subscriptionId", "Subscriptions");
  try {
    await deleteAllFromTable(config.tables.verify, "userId", "Verify");
  } catch (e) {
    if (e.name === "ResourceNotFoundException") console.log("Verify table does not exist (skipped).");
    else throw e;
  }
  await deleteAllFromTable(config.tables.users, "userId", "Users");
  console.log("Done. Statics Cognito and DynamoDB user/subscription/verify data cleared. You can sign up and test from scratch.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
