"""
Lambda handler for API Gateway HTTP API.
GET /health, GET /allowed-numbers, GET /today-picks, POST /run-daily-picks, POST /send-test
"""
import json
import os
from typing import Any, Dict

# Ensure table names from config
os.environ.setdefault("DAILY_PICKS_TABLE", "march_madness_daily_picks")
os.environ.setdefault("PREDICTIONS_LOG_TABLE", "march_madness_predictions_log")

def _response(body: Any, status: int = 200, headers: Dict[str, str] | None = None):
    h = {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
    if headers:
        h.update(headers)
    return {"statusCode": status, "headers": h, "body": json.dumps(body)}

def handler(event: dict, context: object) -> dict:
    request_context = event.get("requestContext", {})
    http = request_context.get("http", {})
    method = http.get("method", event.get("httpMethod", "GET"))
    path = http.get("path", event.get("path", ""))
    raw_path = event.get("rawPath", path)

    path = raw_path or path
    if path.endswith("/") and path != "/":
        path = path.rstrip("/")

    try:
        if path == "/health" and method == "GET":
            return _response({"ok": True, "service": "march-madness-v1"})

        if path == "/allowed-numbers" and method == "GET":
            from services.statics_source import get_march_madness_allowed_numbers
            numbers = get_march_madness_allowed_numbers()
            return _response({"numbers": numbers, "count": len(numbers)})

        if path == "/today-picks" and method == "GET":
            import boto3
            region = os.environ.get("AWS_REGION", "us-east-1")
            table = os.environ.get("DAILY_PICKS_TABLE", "march_madness_daily_picks")
            from datetime import datetime
            pick_date = datetime.utcnow().strftime("%Y-%m-%d")
            dynamo = boto3.client("dynamodb", region_name=region)
            try:
                r = dynamo.get_item(
                    TableName=table,
                    Key={"pick_date": {"S": pick_date}},
                )
                item = r.get("Item")
                if not item:
                    return _response({"pick_date": pick_date, "message": "", "picks": []})
                import base64
                msg = item.get("message", {}).get("S", "")
                picks_raw = item.get("picks", {}).get("S", "[]")
                try:
                    picks = json.loads(picks_raw)
                except Exception:
                    picks = []
                return _response({
                    "pick_date": pick_date,
                    "message": msg,
                    "picks": picks,
                })
            except Exception as e:
                return _response({"error": str(e), "pick_date": pick_date, "message": "", "picks": []}, 500)

        if path == "/run-daily-picks" and method == "POST":
            from jobs.daily_picks import run_daily_picks
            result = run_daily_picks()
            return _response(result)

        if path == "/send-test" and method == "POST":
            body = json.loads(event.get("body") or "{}")
            phone = body.get("phone_number", body.get("phone", ""))
            if not phone:
                return _response({"error": "phone_number required"}, 400)
            from sms import send_sms
            try:
                sid = send_sms(phone, "March Madness Picks – test message. Reply STOP to opt out.")
                return _response({"sent": True, "sid": sid})
            except Exception as e:
                return _response({"error": str(e), "sent": False}, 500)

        if path == "/send-sample" and method == "POST":
            """Send a sample SMS to all March Madness subscribers (from Statics)."""
            from services.statics_source import get_march_madness_allowed_numbers
            from sms import send_bulk_sms
            numbers = get_march_madness_allowed_numbers()
            if not numbers:
                return _response({
                    "sent_count": 0,
                    "numbers_count": 0,
                    "error": "No subscribers. Subscribe in Statics (verified phone) and set STATICS_BASE_URL + STATICS_API_KEY.",
                })
            sample_msg = (
                "March Madness Picks – Sample\n\n"
                "1. [Spread] Duke -4\n   Game: Duke vs UNC – starts 7:00 PM ET\n   Why: Efficiency edge.\n\n"
                "2. [Total] Over 141\n   Game: Duke vs UNC – 7:00 PM ET\n   Why: Pace projects over.\n\n"
                "Reply STOP to opt out."
            )
            results = send_bulk_sms(numbers, sample_msg)
            sent = sum(1 for _, r in results if isinstance(r, str) and not r.startswith("Error"))
            return _response({
                "sent_count": sent,
                "numbers_count": len(numbers),
                "message_preview": sample_msg[:80] + "...",
            })

        return _response({"error": "Not found", "path": path, "method": method}, 404)
    except Exception as e:
        return _response({"error": str(e)}, 500)

# Mangum adapter for API Gateway HTTP API (request format)
def lambda_handler(event: dict, context: object) -> dict:
    # EventBridge scheduled trigger: run daily picks and return
    if event.get("source") == "aws.events" or event.get("detail-type") == "Scheduled Event":
        from jobs.daily_picks import run_daily_picks
        result = run_daily_picks()
        return {"statusCode": 200, "body": json.dumps(result)}
    # API Gateway HTTP API v2 payload
    return handler(event, context)
