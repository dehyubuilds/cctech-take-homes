"""
Load configuration from environment. Never hardcode credentials.
"""
import os

def get_env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()

# College Basketball Data API
CBB_API_BASE_URL = get_env("CBB_API_BASE_URL", "https://api.collegebasketballdata.com")
CBB_API_KEY = get_env("CBB_API_KEY")
CBB_API_SECRET = get_env("CBB_API_SECRET")

# Statics (allowed numbers source)
STATICS_BASE_URL = get_env("STATICS_BASE_URL")
STATICS_API_KEY = get_env("STATICS_API_KEY")
STATICS_TABLE_NAME = get_env("STATICS_TABLE_NAME", "Statics")

# Twilio
TWILIO_ACCOUNT_SID = get_env("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = get_env("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = get_env("TWILIO_PHONE_NUMBER")

# AWS
AWS_REGION = get_env("AWS_REGION", "us-east-1")
S3_BUCKET_NAME = get_env("S3_BUCKET_NAME")

# DynamoDB table names
DAILY_PICKS_TABLE = "march_madness_daily_picks"
PREDICTIONS_LOG_TABLE = "march_madness_predictions_log"
