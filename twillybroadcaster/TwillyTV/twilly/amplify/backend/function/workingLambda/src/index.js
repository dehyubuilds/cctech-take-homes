// Add these tables to the DynamoDB setup
const creatorsTable = {
  TableName: "Creators",
  KeySchema: [
    { AttributeName: "PK", KeyType: "HASH" },  // USER#email
    { AttributeName: "SK", KeyType: "RANGE" }  // CREATOR#timestamp
  ],
  AttributeDefinitions: [
    { AttributeName: "PK", AttributeType: "S" },
    { AttributeName: "SK", AttributeType: "S" },
    { AttributeName: "email", AttributeType: "S" }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "EmailIndex",
      KeySchema: [
        { AttributeName: "email", KeyType: "HASH" }
      ],
      Projection: {
        ProjectionType: "ALL"
      }
    }
  ],
  BillingMode: "PAY_PER_REQUEST"
};

const transactionsTable = {
  TableName: "Transactions",
  KeySchema: [
    { AttributeName: "PK", KeyType: "HASH" },  // USER#email
    { AttributeName: "SK", KeyType: "RANGE" }  // TRANSACTION#timestamp
  ],
  AttributeDefinitions: [
    { AttributeName: "PK", AttributeType: "S" },
    { AttributeName: "SK", AttributeType: "S" },
    { AttributeName: "creatorEmail", AttributeType: "S" }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "CreatorIndex",
      KeySchema: [
        { AttributeName: "creatorEmail", KeyType: "HASH" }
      ],
      Projection: {
        ProjectionType: "ALL"
      }
    }
  ],
  BillingMode: "PAY_PER_REQUEST"
};

const payoutsTable = {
  TableName: "Payouts",
  KeySchema: [
    { AttributeName: "PK", KeyType: "HASH" },  // USER#email
    { AttributeName: "SK", KeyType: "RANGE" }  // PAYOUT#timestamp
  ],
  AttributeDefinitions: [
    { AttributeName: "PK", AttributeType: "S" },
    { AttributeName: "SK", AttributeType: "S" }
  ],
  BillingMode: "PAY_PER_REQUEST"
}; 