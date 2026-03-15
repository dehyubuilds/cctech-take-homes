"""
College Basketball Data API client.
Docs: https://api.collegebasketballdata.com/docs
Base URL: https://api.collegebasketballdata.com
"""
import os
import requests
from typing import Any, Optional

def _base_url() -> str:
    return os.environ.get("CBB_API_BASE_URL", "https://api.collegebasketballdata.com").rstrip("/")

def _headers() -> dict:
    key = os.environ.get("CBB_API_KEY", "")
    secret = os.environ.get("CBB_API_SECRET", "")
    # API may use Authorization or query params; adjust per actual docs
    if key:
        return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    return {"Content-Type": "application/json"}

def _get(path: str, params: Optional[dict] = None) -> list:
    url = f"{_base_url()}{path}"
    try:
        r = requests.get(url, headers=_headers(), params=params or {}, timeout=30)
        r.raise_for_status()
        return r.json() if r.text else []
    except requests.RequestException as e:
        raise RuntimeError(f"CBB API request failed: {e}") from e

def get_todays_games() -> list[dict[str, Any]]:
    """
    Return today's games. Uses /games with year and date.
    Date format in API is typically YYYYMMDD or YYYY-MM-DD.
    """
    from datetime import date
    today = date.today()
    year = today.year
    # Season for March is usually same year
    month, day = today.month, today.day
    date_str = f"{month:02d}/{day:02d}"
    # API docs: GET /games often takes year, optional team, etc.
    return _get("/games", params={"year": year, "date": date_str})

def get_team_stats(team_id: str) -> dict[str, Any]:
    """Team season stats. GET /stats/team/season."""
    data = _get("/stats/team/season", params={"team": team_id})
    return data[0] if isinstance(data, list) and data else {}

def get_player_stats(team_id: str) -> list[dict[str, Any]]:
    """Player season stats for a team. GET /stats/player/season with team."""
    return _get("/stats/player/season", params={"team": team_id})

def get_recent_games(team_id: str, limit: int = 5) -> list[dict[str, Any]]:
    """Recent games for a team. GET /games filtered by team."""
    from datetime import date, timedelta
    today = date.today()
    start = (today - timedelta(days=30)).strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")
    all_games = _get("/games", params={"team": team_id, "start": start, "end": end})
    if isinstance(all_games, list):
        return all_games[-limit:] if len(all_games) > limit else all_games
    return []
