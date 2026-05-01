#!/usr/bin/env python3
"""
Poll DynamoDB for async jobs (local WebSocket mode):

- **youtube_dropflow** (Dropflow): this process alone runs yt-dlp and writes to S3 — no second HTTP service, no
  extra bearer token beyond AWS credentials for Dynamo/S3/API Gateway.
- **aotq_whisper** (Art of the Question): this process only *bridges* — it `POST`s to the AoTQ **FastAPI** worker
  (`scripts/aotq-ec2-worker`, `/ingest`) which runs Whisper and updates Dynamo. That `POST` must send the same
  `Authorization: Bearer …` as `AOTQ_WORKER_BEARER_TOKEN` on the FastAPI side (auto-merged from
  `scripts/aotq-ec2-worker/.env` if unset).

Run where AWS creds can use the jobs table + (for YouTube) S3 + (for AoTQ) Dynamo `aotq` + `execute-api:ManageConnections`.
"""

from __future__ import annotations

import glob
import json
import logging
import os
import re
import socket
from pathlib import Path
import subprocess
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import boto3
from botocore.exceptions import ClientError

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("local-yt-worker")

PROGRESS_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%")
_CHROME_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _merge_dotenv_file(path: Path) -> bool:
    """Merge KEY=value lines into os.environ only for keys not already set. Returns True if file was read."""
    if not path.is_file():
        return False
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        if not key or key in os.environ:
            continue
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        if not val:
            continue
        os.environ[key] = val
    return True


def _load_dotenv() -> None:
    """Load `worker/.env`, then `scripts/aotq-ec2-worker/.env` (AoTQ FastAPI), without overriding existing os.environ."""
    here = Path(__file__).resolve().parent
    _merge_dotenv_file(here / ".env")
    aotq_env = here.parent.parent / "aotq-ec2-worker" / ".env"
    if _merge_dotenv_file(aotq_env):
        logger.info("merged missing keys from %s", aotq_env)


def _aotq_ingest_tcp_target() -> tuple[str, int]:
    raw = os.environ.get("AOTQ_LOCAL_WORKER_INTERNAL_URL", "http://127.0.0.1:8787").strip()
    if "://" not in raw:
        raw = "http://" + raw
    u = urlparse(raw)
    host = u.hostname or "127.0.0.1"
    if u.port is not None:
        return host, u.port
    return host, 443 if (u.scheme or "http") == "https" else 80


def _log_if_aotq_ingest_unreachable() -> None:
    """AoTQ bridge needs a second process on this port; warn once at startup if nothing is listening."""
    host, port = _aotq_ingest_tcp_target()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.5)
    try:
        if sock.connect_ex((host, port)) == 0:
            return
    finally:
        sock.close()
    here = Path(__file__).resolve().parent
    aotq_dir = here.parent.parent / "aotq-ec2-worker"
    combo = here.parent / "start-local-bridge-with-aotq.sh"
    logger.warning(
        "AoTQ FastAPI ingest is not reachable on %s:%s — aotq_whisper jobs will fail until you start it.\n"
        "  Terminal A: cd %s && ./run.sh\n"
        "  Or single command (ingest + this bridge): %s",
        host,
        port,
        aotq_dir,
        combo,
    )


def _s3():
    return boto3.client("s3", region_name=os.environ.get("AWS_REGION", "us-east-1"))


def _ddb():
    return boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))


def _mgmt():
    ep = os.environ.get("AWS_APIGW_WS_MANAGEMENT_ENDPOINT", "").strip().rstrip("/")
    if not ep:
        raise SystemExit("Set AWS_APIGW_WS_MANAGEMENT_ENDPOINT (https://…execute-api…/prod)")
    return boto3.client("apigatewaymanagementapi", endpoint_url=ep)


def _write_job(s3, bucket: str, key: str, payload: dict[str, Any]) -> None:
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        ContentType="application/json",
    )


def _post_ws(mgmt, connection_id: str, msg: dict[str, Any]) -> None:
    if not connection_id:
        return
    try:
        mgmt.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(msg).encode("utf-8"),
        )
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code == "GoneException":
            logger.warning("client gone connectionId=%s", connection_id)
        else:
            logger.warning("post_to_connection failed: %s", e)


def _yt_dlp_cmd_base(cookies_file: str | None) -> list[str]:
    ex = os.environ.get("YTDLP_YOUTUBE_EXTRACTOR_ARGS", "").strip() or "youtube:player_client=android,tv"
    cmd = [
        "yt-dlp",
        "--no-warnings",
        "--no-playlist",
        "--user-agent",
        _CHROME_UA,
        "--extractor-args",
        ex,
    ]
    if cookies_file and os.path.isfile(cookies_file):
        cmd.extend(["--cookies", cookies_file])
    return cmd


def _run_download_with_ws(
    *,
    job_id: str,
    cmd: list[str],
    mgmt,
    connection_id: str,
    s3,
    bucket: str,
    status_key: str,
    status_payload: dict[str, Any],
    timeout_sec: int,
) -> tuple[int, str]:
    stderr_lines: list[str] = []
    latest_pct = 0.0
    lock = threading.Lock()
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    def pump() -> None:
        nonlocal latest_pct
        try:
            if proc.stderr:
                for line in proc.stderr:
                    stderr_lines.append(line)
                    if len(stderr_lines) > 800:
                        del stderr_lines[:300]
                    m = PROGRESS_RE.search(line)
                    if m:
                        with lock:
                            v = float(m.group(1))
                            if v > latest_pct:
                                latest_pct = v
        except Exception as ex:
            logger.warning("stderr pump: %s", ex)

    th = threading.Thread(target=pump, daemon=True)
    th.start()
    deadline = time.monotonic() + timeout_sec
    last_ws = 0.0
    rc: int | None = None
    try:
        while True:
            rc = proc.poll()
            now = time.monotonic()
            if now >= deadline:
                proc.kill()
                th.join(timeout=5)
                return -9, "".join(stderr_lines[-120:])
            if now - last_ws >= 2.0:
                last_ws = now
                with lock:
                    p_int = int(min(99, latest_pct))
                payload = {
                    **status_payload,
                    "progressPercent": p_int,
                    "phase": "download",
                    "updatedAt": _now_iso(),
                }
                _write_job(s3, bucket, status_key, payload)
                _post_ws(mgmt, connection_id, {"type": "progress", "jobId": job_id, "percent": p_int})
            if rc is not None:
                break
            time.sleep(0.35)
    finally:
        th.join(timeout=20)
    return proc.returncode if proc.returncode is not None else -1, "".join(stderr_lines[-2000:])


def _aotq_source_key(project_id: str, source_id: str) -> dict[str, str]:
    return {"pk": f"VIDEO_PROJECT#{project_id}", "sk": f"SOURCE#{source_id}"}


def _aotq_set_source_error(table_name: str, project_id: str, source_id: str, message: str) -> None:
    tbl = _ddb().Table(table_name)
    tbl.update_item(
        Key=_aotq_source_key(project_id, source_id),
        UpdateExpression="SET #s = :e, errorMessage = :m, updatedAt = :u",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":e": "error",
            ":m": message[:2000],
            ":u": _now_iso(),
        },
    )


def _aotq_get_source(table_name: str, project_id: str, source_id: str) -> dict[str, Any] | None:
    tbl = _ddb().Table(table_name)
    r = tbl.get_item(Key=_aotq_source_key(project_id, source_id), ConsistentRead=True)
    row = r.get("Item")
    if not row or row.get("entity") != "video_project_source":
        return None
    return row


def _ingest_http_post(base_url: str, bearer: str, body: dict[str, Any]) -> int:
    url = base_url.rstrip("/") + "/ingest"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {bearer}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return int(resp.status)
    except urllib.error.HTTPError as e:
        return int(e.code)


def _process_aotq_whisper(item: dict[str, Any]) -> None:
    mgmt = _mgmt()
    job_id = str(item["jobId"])
    connection_id = str(item.get("connectionId") or "")
    project_id = str(item["projectId"])
    source_id = str(item["sourceId"])
    table_name = str(item["tableName"])
    internal_base = os.environ.get("AOTQ_LOCAL_WORKER_INTERNAL_URL", "http://127.0.0.1:8787").strip().rstrip("/")
    bearer = (
        os.environ.get("AOTQ_LOCAL_WORKER_INTERNAL_BEARER", "").strip()
        or os.environ.get("AOTQ_WORKER_BEARER_TOKEN", "").strip()
        or os.environ.get("AOTQ_WORKER_API_SECRET", "").strip()
    )
    if not bearer:
        raise RuntimeError(
            "Missing /ingest bearer: set AOTQ_WORKER_BEARER_TOKEN in scripts/aotq-ec2-worker/.env "
            "(auto-loaded by this process), or export AOTQ_WORKER_API_SECRET / AOTQ_LOCAL_WORKER_INTERNAL_BEARER "
            "(must match the AoTQ FastAPI worker token)"
        )

    body = {
        "projectId": project_id,
        "sourceId": source_id,
        "userId": str(item["userId"]),
        "youtubeUrl": str(item["youtubeUrl"]),
        "videoId": str(item["videoId"]),
        "tableName": table_name,
        "runLlmAfterTranscribe": bool(item.get("runLlmAfterTranscribe")),
    }
    _post_ws(mgmt, connection_id, {"type": "phase", "jobId": job_id, "phase": "starting"})
    try:
        code = _ingest_http_post(internal_base, bearer, body)
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", e)
        msg = (
            f"Cannot reach AoTQ ingest at {internal_base}/ingest ({reason}). "
            "Start the FastAPI worker: cd scripts/aotq-ec2-worker && ./run.sh "
            "(same machine, default port 8787). Or run scripts/local-youtube-import-worker/start-local-bridge-with-aotq.sh "
            "to start uvicorn and this bridge together."
        )
        logger.warning("aotq /ingest: %s", msg)
        _aotq_set_source_error(table_name, project_id, source_id, msg)
        _post_ws(mgmt, connection_id, {"type": "error", "jobId": job_id, "message": msg[:800]})
        return
    if code != 202:
        msg = f"Worker /ingest returned HTTP {code} (is the AoTQ FastAPI worker running on {internal_base}?)"
        _aotq_set_source_error(table_name, project_id, source_id, msg)
        _post_ws(mgmt, connection_id, {"type": "error", "jobId": job_id, "message": msg})
        return

    _post_ws(mgmt, connection_id, {"type": "phase", "jobId": job_id, "phase": "whisper"})
    deadline = time.monotonic() + float(os.environ.get("AOTQ_LOCAL_WS_POLL_TIMEOUT_SEC", "2700"))
    last_ws = 0.0
    tick = 0
    while time.monotonic() < deadline:
        row = _aotq_get_source(table_name, project_id, source_id)
        if not row:
            msg = "Source row missing while polling."
            _post_ws(mgmt, connection_id, {"type": "error", "jobId": job_id, "message": msg})
            return
        st = str(row.get("status") or "")
        if st == "ready":
            _post_ws(mgmt, connection_id, {"type": "complete", "jobId": job_id})
            logger.info("aotq ingest ok jobId=%s source=%s", job_id, source_id)
            return
        if st == "error":
            em = str(row.get("errorMessage") or "ingest error")
            _post_ws(mgmt, connection_id, {"type": "error", "jobId": job_id, "message": em[:800]})
            return
        now = time.monotonic()
        if now - last_ws >= 8.0:
            last_ws = now
            tick += 1
            pct = min(92, 5 + tick * 3)
            _post_ws(mgmt, connection_id, {"type": "progress", "jobId": job_id, "percent": pct})
        time.sleep(3)

    msg = "Timed out waiting for Whisper ingest (check worker logs)."
    _aotq_set_source_error(table_name, project_id, source_id, msg)
    _post_ws(mgmt, connection_id, {"type": "error", "jobId": job_id, "message": msg})


def _process_youtube_dropflow(item: dict[str, Any]) -> None:
    s3 = _s3()
    mgmt = _mgmt()
    job_id = item["jobId"]
    user_id = item["userId"]
    youtube_url = item["youtubeUrl"]
    target = item["target"]
    bucket = item["bucket"]
    base_url = str(item.get("baseUrl") or "").rstrip("/")
    status_key = item["statusKey"]
    connection_id = str(item.get("connectionId") or "")
    max_video = int(item.get("maxVideoBytes") or (320 * 1024 * 1024))
    max_mb = max(1, max_video // (1024 * 1024))
    cookies = os.environ.get("YOUTUBE_COOKIES_FILE", "").strip() or None

    if target != "dropflow_track":
        _post_ws(mgmt, connection_id, {"type": "error", "jobId": job_id, "message": "starter worker: only dropflow_track"})
        _write_job(
            s3,
            bucket,
            status_key,
            {
                "userId": user_id,
                "jobId": job_id,
                "status": "failed",
                "error": "Local worker starter supports dropflow_track only.",
            },
        )
        return

    started_at = _now_iso()
    video_id = str(item.get("videoId") or "").strip()
    base_status = {
        "userId": user_id,
        "jobId": job_id,
        "status": "processing",
        "title": "",
        "startedAt": started_at,
        "progressPercent": 0,
        "phase": "download",
        **({"videoId": video_id} if len(video_id) == 11 else {}),
    }
    _write_job(s3, bucket, status_key, base_status)
    _post_ws(mgmt, connection_id, {"type": "phase", "jobId": job_id, "phase": "download"})

    tmp = f"/tmp/local-yt-{job_id}"
    os.makedirs(tmp, exist_ok=True)
    out_base = os.path.join(tmp, "out")
    template = f"{out_base}.%(ext)s"

    dl_cmd = [
        *_yt_dlp_cmd_base(cookies),
        "-x",
        "--audio-format",
        "m4a",
        "--max-filesize",
        f"{max_mb}M",
        "-o",
        template,
        youtube_url,
    ]
    rc, err = _run_download_with_ws(
        job_id=job_id,
        cmd=dl_cmd,
        mgmt=mgmt,
        connection_id=connection_id,
        s3=s3,
        bucket=bucket,
        status_key=status_key,
        status_payload=base_status,
        timeout_sec=600,
    )
    if rc == -9:
        _write_job(s3, bucket, status_key, {**base_status, "status": "failed", "error": "Download timed out."})
        _post_ws(mgmt, connection_id, {"type": "error", "jobId": job_id, "message": "timeout"})
        return
    if rc != 0:
        _write_job(s3, bucket, status_key, {**base_status, "status": "failed", "error": err[-4000:]})
        _post_ws(mgmt, connection_id, {"type": "error", "jobId": job_id, "message": err[-500:]})
        return

    files = [f for f in glob.glob(f"{out_base}.*") if not f.endswith(".part") and os.path.isfile(f)]
    if not files:
        _write_job(s3, bucket, status_key, {**base_status, "status": "failed", "error": "No audio file produced"})
        return
    local_path = files[0]
    ext = os.path.splitext(local_path)[1].lstrip(".") or "m4a"
    if ext not in ("m4a", "mp3", "opus", "webm", "ogg"):
        ext = "m4a"
    s3_key = f"tracks/yt-{job_id}.{ext}"
    ctype = "audio/mp4" if ext == "m4a" else f"audio/{ext}"
    s3.upload_file(local_path, bucket, s3_key, ExtraArgs={"ContentType": ctype})
    file_url = f"{base_url}/{s3_key}"
    done_payload: dict[str, Any] = {
        "userId": user_id,
        "jobId": job_id,
        "status": "completed",
        "fileUrl": file_url,
        "s3Key": s3_key,
        "title": "",
        "thumbnailUrl": None,
    }
    if len(video_id) == 11:
        done_payload["videoId"] = video_id
    _write_job(s3, bucket, status_key, done_payload)
    _post_ws(mgmt, connection_id, {"type": "complete", "jobId": job_id, "fileUrl": file_url})
    logger.info("job ok jobId=%s key=%s", job_id, s3_key)


def main() -> None:
    _load_dotenv()
    table_name = os.environ.get("JOBS_TABLE", "").strip()
    if not table_name:
        raise SystemExit(
            "Set JOBS_TABLE (e.g. in worker/.env next to run_worker.py — see .env.example). "
            "Must match config.youtubeImport.localWsJobsTable in Statics."
        )
    table = _ddb().Table(table_name)
    logger.info("polling table=%s", table_name)
    _log_if_aotq_ingest_unreachable()
    while True:
        try:
            resp = table.scan(
                FilterExpression="jobStatus = :p AND attribute_exists(connectionId)",
                ExpressionAttributeValues={":p": "PENDING_WORKER"},
                Limit=25,
            )
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "")
            if code == "ResourceNotFoundException":
                logger.error(
                    "scan failed: table %r does not exist in this region/account. "
                    "Set JOBS_TABLE to SAM output JobsTableName (same as config.youtubeImport.localWsJobsTable in Statics).",
                    table_name,
                )
            else:
                logger.error("scan failed: %s", e)
            time.sleep(5)
            continue

        for item in resp.get("Items", []):
            job_id = item.get("jobId")
            if not job_id:
                continue
            try:
                table.update_item(
                    Key={"jobId": job_id},
                    UpdateExpression="SET jobStatus = :w",
                    ConditionExpression="jobStatus = :p",
                    ExpressionAttributeValues={":w": "WORKING", ":p": "PENDING_WORKER"},
                )
            except ClientError:
                continue
            try:
                fresh = table.get_item(Key={"jobId": job_id}).get("Item") or item
                if fresh.get("jobKind") == "aotq_whisper":
                    _process_aotq_whisper(fresh)
                else:
                    _process_youtube_dropflow(fresh)
            except Exception as e:
                logger.exception("job failed")
                try:
                    fr = table.get_item(Key={"jobId": job_id}).get("Item") or item
                    if fr.get("jobKind") == "aotq_whisper":
                        tn = str(fr.get("tableName") or "").strip()
                        pid = str(fr.get("projectId") or "").strip()
                        sid = str(fr.get("sourceId") or "").strip()
                        if tn and pid and sid:
                            _aotq_set_source_error(tn, pid, sid, str(e)[:2000])
                    elif fr.get("statusKey") and fr.get("bucket"):
                        _s3().put_object(
                            Bucket=fr["bucket"],
                            Key=fr["statusKey"],
                            Body=json.dumps(
                                {
                                    "userId": fr.get("userId"),
                                    "jobId": job_id,
                                    "status": "failed",
                                    "error": str(e)[:4000],
                                }
                            ).encode(),
                            ContentType="application/json",
                        )
                except Exception:
                    pass
            finally:
                try:
                    table.update_item(
                        Key={"jobId": job_id},
                        UpdateExpression="SET jobStatus = :d",
                        ExpressionAttributeValues={":d": "DONE"},
                    )
                except ClientError:
                    pass

        time.sleep(3)


if __name__ == "__main__":
    main()
