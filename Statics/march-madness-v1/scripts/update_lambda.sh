#!/usr/bin/env bash
# Update Lambda code only (after code changes).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$ROOT_DIR/.env" 2>/dev/null || true
REGION="${AWS_REGION:-us-east-1}"
FUNC_NAME="march-madness-v1"

"$SCRIPT_DIR/package_lambda.sh"
aws lambda update-function-code --function-name "$FUNC_NAME" --zip-file "fileb://$ROOT_DIR/lambda.zip" --region "$REGION"
echo "Lambda updated."
