#!/usr/bin/env node
/**
 * Remove a user by email and all associated data:
 * - DynamoDB: user, subscriptions, verify (phone code) entry
 * - Cognito: user from Statics User Pool (so you can sign up again from scratch)
 *
 * Uses same hardcoded config as Statics app. Run from repo root: node scripts/remove-user-by-email.mjs
 *
 * Usage: node scripts/remove-user-by-email.mjs [email]
 * Default email: dehyubuilds@gmail.com
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
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

const email = (process.argv[2] || "dehyubuilds@gmail.com").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/remove-user-by-email.mjs [email]");
  process.exit(1);
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
  console.log("Looking up user by email:", email);
  const { Items: userItems } = await doc.send(
    new QueryCommand({
      TableName: config.tables.users,
      IndexName: "email-index",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": email },
    })
  );
  const user = userItems?.[0];
  if (!user) {
    console.log("No user found with that email. Nothing to remove.");
    return;
  }
  const userId = user.userId;
  console.log("Found user:", userId, "| Removing...");

  const { Items: subItems } = await doc.send(
    new QueryCommand({
      TableName: config.tables.subscriptions,
      IndexName: "user-app-index",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );
  for (const sub of subItems || []) {
    await doc.send(
      new DeleteCommand({
        TableName: config.tables.subscriptions,
        Key: { subscriptionId: sub.subscriptionId },
      })
    );
    console.log("  Deleted subscription:", sub.subscriptionId);
  }
  if ((subItems?.length ?? 0) === 0) {
    console.log("  No subscriptions to delete.");
  }

  try {
    await doc.send(
      new DeleteCommand({
        TableName: config.tables.verify,
        Key: { userId },
      })
    );
    console.log("  Deleted verify entry (if any).");
  } catch (e) {
    if (e.name === "ResourceNotFoundException") {
      console.log("  Verify table does not exist (skipped).");
    } else throw e;
  }

  await doc.send(
    new DeleteCommand({
      TableName: config.tables.users,
      Key: { userId },
    })
  );
  console.log("  Deleted user:", userId);

  const cognito = new CognitoIdentityProviderClient({
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
  const { Users: cognitoUsers } = await cognito.send(
    new ListUsersCommand({
      UserPoolId: config.cognito.userPoolId,
      Filter: `email = "${email}"`,
    })
  );
  const cognitoUser = cognitoUsers?.[0];
  if (cognitoUser) {
    await cognito.send(
      new AdminDeleteUserCommand({
        UserPoolId: config.cognito.userPoolId,
        Username: cognitoUser.Username,
      })
    );
    console.log("  Deleted Cognito user:", cognitoUser.Username);
  } else {
    console.log("  No Cognito user found with that email (skipped).");
  }

  console.log("Done. User and associated data removed. You can sign up again with this email.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
