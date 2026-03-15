"""
Normalize API responses into consistent structures for scoring.
"""
from typing import Any, Dict, List

def normalize_team_stats(raw: dict) -> dict:
    """Extract efficiency, pace, 3PT, turnover from team stats."""
    out = {
        "off_eff": 0.0,
        "def_eff": 0.0,
        "pace": 0.0,
        "turnover_pct": 0.0,
        "three_pct": 0.0,
        "three_attempt_rate": 0.0,
    }
    if not raw:
        return out
    # Map common field names (adjust to actual CBB API response)
    out["off_eff"] = float(raw.get("offensive_efficiency", raw.get("adj_off", raw.get("off_eff", 0))) or 0)
    out["def_eff"] = float(raw.get("defensive_efficiency", raw.get("adj_def", raw.get("def_eff", 0))) or 0)
    out["pace"] = float(raw.get("pace", raw.get("poss_per_40", 0))) or 0
    out["turnover_pct"] = float(raw.get("turnover_pct", raw.get("to_pct", 0))) or 0
    out["three_pct"] = float(raw.get("three_point_pct", raw.get("fg3_pct", 0))) or 0
    out["three_attempt_rate"] = float(raw.get("three_attempt_rate", raw.get("fg3a_rate", 0))) or 0
    return out

def normalize_player_stats(raw: list) -> list:
    """List of players with 3PA, 3P% for prop scoring."""
    out = []
    for p in raw or []:
        out.append({
            "player_id": p.get("player_id", p.get("id", "")),
            "name": p.get("name", p.get("player", "Unknown")),
            "team_id": p.get("team_id", p.get("team", "")),
            "three_pa": float(p.get("three_point_attempts", p.get("fg3a", 0))) or 0,
            "three_pct": float(p.get("three_point_pct", p.get("fg3_pct", 0))) or 0,
        })
    return out

def normalize_game(raw: dict) -> dict:
    """Single game with home, away, id, date, and optional start time (UTC or local)."""
    date_val = raw.get("date", raw.get("start_date", raw.get("game_date", "")))
    start_time = raw.get("start_time", raw.get("start_time_utc", raw.get("scheduled_time", "")))
    return {
        "game_id": str(raw.get("id", raw.get("game_id", ""))),
        "home_team_id": str(raw.get("home_team_id", raw.get("home_team", ""))),
        "away_team_id": str(raw.get("away_team_id", raw.get("away_team", ""))),
        "home_team_name": raw.get("home_team_name", raw.get("home", "")),
        "away_team_name": raw.get("away_team_name", raw.get("away", "")),
        "date": date_val,
        "start_time": start_time,
        "raw": raw,
    }
