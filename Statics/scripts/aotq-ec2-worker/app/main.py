"""
Art of the Question — EC2 ingest API.

Statics calls `POST /ingest` with Bearer auth; this app returns 202 and processes in background.
"""

from __future__ import annotations

import hmac
import logging
import os
import threading
from typing import Any, Literal

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app.job import run_ingest_job
from app.settings import bearer_token
from app.youtube_import_job_impl import run_youtube_import_job

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("aotq-worker")

# One ingest at a time avoids OOM when many long videos are queued (e.g. full playlists).
_ingest_job_lock = threading.Lock()
# Dropflow / PC YouTube → S3 (yt-dlp) — separate lock so a long PC mux does not block AoTQ Whisper jobs.
_youtube_import_lock = threading.Lock()


def _run_ingest_job_serialized(payload: dict[str, Any]) -> None:
    with _ingest_job_lock:
        run_ingest_job(payload)


def _run_youtube_import_serialized(payload: dict[str, Any]) -> None:
    with _youtube_import_lock:
        try:
            run_youtube_import_job(payload, None)
        except Exception:
            logger.exception("youtube-import job crashed")


class IngestBody(BaseModel):
    projectId: str = Field(..., min_length=1)
    sourceId: str = Field(..., min_length=1)
    userId: str = Field(..., min_length=1)
    youtubeUrl: str = Field(..., min_length=8)
    videoId: str = Field(..., min_length=6, max_length=32)
    tableName: str = Field(..., min_length=1)
    runLlmAfterTranscribe: bool = False


class YoutubeImportBody(BaseModel):
    """Same JSON shape as the Dropflow Lambda async invoke payload."""

    jobId: str = Field(..., min_length=4)
    userId: str = Field(..., min_length=1)
    youtubeUrl: str = Field(..., min_length=8)
    target: Literal["dropflow_track", "pc_video"]
    bucket: str = Field(..., min_length=1)
    baseUrl: str = Field(..., min_length=8)
    statusKey: str = Field(..., min_length=1)
    maxVideoBytes: int = 320 * 1024 * 1024


app = FastAPI(title="AOTQ EC2 Worker", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _auth_bearer(authorization: str | None) -> None:
    expected = bearer_token()
    if not expected:
        raise HTTPException(status_code=503, detail="Server misconfigured: AOTQ_WORKER_BEARER_TOKEN")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    got = authorization[7:].strip()
    if not hmac.compare_digest(got, expected):
        raise HTTPException(status_code=401, detail="Invalid Bearer token")


@app.post("/ingest", status_code=202)
def ingest(
    body: IngestBody,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    _auth_bearer(authorization)
    payload = body.model_dump()
    background_tasks.add_task(_run_ingest_job_serialized, payload)
    return {"accepted": True, "projectId": body.projectId, "sourceId": body.sourceId}


@app.post("/youtube-import", status_code=202)
def youtube_import(
    body: YoutubeImportBody,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    """Dropflow + Private Collection: yt-dlp on EC2 → same S3 job JSON + media keys as Lambda."""
    _auth_bearer(authorization)
    payload = body.model_dump()
    background_tasks.add_task(_run_youtube_import_serialized, payload)
    return {"accepted": True, "jobId": body.jobId, "target": body.target}


def main() -> None:
    import uvicorn

    host = os.environ.get("AOTQ_WORKER_HOST", "0.0.0.0").strip()
    port = int(os.environ.get("AOTQ_WORKER_PORT", "8787").strip() or "8787")
    uvicorn.run("app.main:app", host=host, port=port, workers=1, log_level="info")


if __name__ == "__main__":
    main()
