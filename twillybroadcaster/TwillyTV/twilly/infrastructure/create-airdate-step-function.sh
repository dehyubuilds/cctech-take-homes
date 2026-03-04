#!/bin/bash

# Set AWS Account ID
AWS_ACCOUNT_ID="142770202579"

# Create Step Function for airdate scheduling
echo "Creating Step Function for airdate scheduling..."

# Create the Step Function definition
cat > airdate-step-function.json << 'EOF'
{
  "Comment": "Airdate scheduling workflow",
  "StartAt": "WaitForAirdate",
  "States": {
    "WaitForAirdate": {
      "Type": "Wait",
      "TimestampPath": "$.airdate",
      "Next": "UpdateVisibility"
    },
    "UpdateVisibility": {
      "Type": "Task",
      "Resource": "arn:aws:states:::dynamodb:updateItem",
      "Parameters": {
        "TableName": "Twilly",
        "Key": {
          "PK": {
            "S.$": "States.Format('USER#{}', $.userId)"
          },
          "SK": {
            "S.$": "$.episodeId"
          }
        },
        "UpdateExpression": "SET isVisible = :isVisible, airdate = :airdate",
        "ExpressionAttributeValues": {
          ":isVisible": {
            "BOOL": true
          },
          ":airdate": {
            "S": null
          }
        }
      },
      "End": true
    }
  }
}
EOF

# Create the Step Function
aws stepfunctions create-state-machine \
  --name "AirdateScheduler" \
  --definition file://airdate-step-function.json \
  --role-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:role/StepFunctionsExecutionRole" \
  --region us-east-1

echo "Step Function created successfully!"

# Clean up
rm airdate-step-function.json

echo "Airdate scheduling infrastructure created successfully!" 