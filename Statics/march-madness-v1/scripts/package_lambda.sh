#!/usr/bin/env bash
# Package backend for Lambda (zip with dependencies). Handler: app.lambda_handler.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"
ZIP_FILE="$ROOT_DIR/lambda.zip"
rm -rf "$BUILD_DIR" && mkdir -p "$BUILD_DIR"

echo "Installing dependencies..."
pip install -r "$ROOT_DIR/backend/requirements.txt" -t "$BUILD_DIR" --quiet
cp "$ROOT_DIR/backend/app.py" "$ROOT_DIR/backend/config.py" "$ROOT_DIR/backend/sms.py" "$BUILD_DIR/"
cp -r "$ROOT_DIR/backend/services" "$ROOT_DIR/backend/jobs" "$BUILD_DIR/"
cd "$BUILD_DIR"
zip -r "$ZIP_FILE" . -x "*.pyc" -x "__pycache__/*" -x ".env" -q
echo "Created $ZIP_FILE"
