"""API Gateway WebSocket $connect / $disconnect / $default — registers browser connectionId on Dynamo job."""

from __future__ import annotations

import json
import logging
import os

import boto3
from botocore.exceptions import ClientError

log = logging.getLogger()
log.setLevel(logging.INFO)

_ddb = boto3.resource("dynamodb")


def _table():
    name = os.environ.get("JOBS_TABLE", "").strip()
    if not name:
        raise RuntimeError("JOBS_TABLE env missing")
    return _ddb.Table(name)


def _mgmt_client(event: dict) -> boto3.client:
    rc = event["requestContext"]
    domain = rc["domainName"]
    stage = rc["stage"]
    return boto3.client(
        "apigatewaymanagementapi",
        endpoint_url=f"https://{domain}/{stage}",
    )


def handler(event: dict, context: object) -> dict:
    rc = event["requestContext"]
    route = rc.get("routeKey") or ""
    cid = rc.get("connectionId") or ""

    if route == "$connect":
        log.info("ws connect connectionId=%s", cid)
        return {"statusCode": 200}

    if route == "$disconnect":
        log.info("ws disconnect connectionId=%s", cid)
        return {"statusCode": 200}

    # Messages: route key is $default or "register" when RouteSelectionExpression is $request.body.action.
    if route not in ("$default", "register"):
        return {"statusCode": 200}
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        body = {}

    action = body.get("action")
    if action != "register":
        try:
            _mgmt_client(event).post_to_connection(
                ConnectionId=cid,
                Data=json.dumps({"type": "error", "message": "unknown action"}).encode("utf-8"),
            )
        except ClientError:
            pass
        return {"statusCode": 200}

    job_id = str(body.get("jobId") or "").strip()
    token = str(body.get("registerToken") or "").strip()
    if not job_id or not token:
        try:
            _mgmt_client(event).post_to_connection(
                ConnectionId=cid,
                Data=json.dumps({"type": "error", "message": "jobId and registerToken required"}).encode("utf-8"),
            )
        except ClientError:
            pass
        return {"statusCode": 200}

    table = _table()
    try:
        item = table.get_item(Key={"jobId": job_id}).get("Item") or {}
    except ClientError as e:
        log.exception("ddb get")
        return {"statusCode": 200}

    if item.get("registerToken") != token:
        try:
            _mgmt_client(event).post_to_connection(
                ConnectionId=cid,
                Data=json.dumps({"type": "error", "message": "invalid registerToken"}).encode("utf-8"),
            )
        except ClientError:
            pass
        return {"statusCode": 200}

    if item.get("jobStatus") not in ("AWAITING_REGISTER", "PENDING_WORKER"):
        try:
            _mgmt_client(event).post_to_connection(
                ConnectionId=cid,
                Data=json.dumps({"type": "error", "message": "job not awaiting registration"}).encode("utf-8"),
            )
        except ClientError:
            pass
        return {"statusCode": 200}

    try:
        table.update_item(
            Key={"jobId": job_id},
            UpdateExpression="SET connectionId = :c, jobStatus = :s",
            ExpressionAttributeValues={":c": cid, ":s": "PENDING_WORKER"},
        )
    except ClientError:
        log.exception("ddb update register")
        return {"statusCode": 200}

    try:
        _mgmt_client(event).post_to_connection(
            ConnectionId=cid,
            Data=json.dumps({"type": "registered", "jobId": job_id}).encode("utf-8"),
        )
    except ClientError as e:
        log.warning("post_to_connection registered failed: %s", e)

    return {"statusCode": 200}
