"""
Rank edges and select top picks. Deterministic.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

def _format_game_time(game_date: str, game_start_time: str) -> str:
    """Format game date/time for SMS, defaulting to ET."""
    if not game_date and not game_start_time:
        return ""
    parts = []
    if game_date:
        try:
            if "T" in game_date:
                dt = datetime.fromisoformat(game_date.replace("Z", "+00:00"))
            elif "-" in game_date:
                dt = datetime.strptime(game_date[:10], "%Y-%m-%d")
            else:
                dt = datetime.strptime(str(game_date)[:8], "%Y%m%d") if len(str(game_date)) >= 8 else None
            if dt:
                parts.append(dt.strftime("%a %b %d"))
        except Exception:
            parts.append(str(game_date)[:10])
    if game_start_time:
        t = str(game_start_time).strip()
        if "T" in t:
            try:
                dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
                parts.append(dt.strftime("%I:%M %p ET"))
            except Exception:
                parts.append(t[:5] if len(t) >= 5 else t)
        elif len(t) >= 4:
            parts.append(t[:5] + " ET" if ":" in t else t + " ET")
    return " – ".join(parts) if parts else ""


def rank_edges(features_list: List[dict]) -> List[dict]:
    """
    Rank all spread/total/prop edges and return top 3 combined.
    Each pick: { type, selection, explanation, score, game_id, game_label, game_starts }
    """
    picks = []
    for f in features_list:
        home = f.get("home", "Home")
        away = f.get("away", "Away")
        game_label = f"{home} vs {away}" if (home and away) else ""
        game_starts = _format_game_time(f.get("game_date", ""), f.get("game_start_time", ""))
        if f.get("spread_score", 0) != 0:
            picks.append({
                "type": "spread",
                "selection": f"{home} -4",
                "explanation": f.get("spread_expl", ""),
                "score": f["spread_score"],
                "game_id": f.get("game_id"),
                "game_label": game_label,
                "game_starts": game_starts,
            })
        if f.get("total_score", 0) != 0:
            picks.append({
                "type": "total",
                "selection": f"{home}/{away} Over 141",
                "explanation": f.get("total_expl", ""),
                "score": f["total_score"],
                "game_id": f.get("game_id"),
                "game_label": game_label,
                "game_starts": game_starts,
            })
        if f.get("prop_score", 0) != 0:
            picks.append({
                "type": "prop",
                "selection": "Smith over 2.5 threes",
                "explanation": f.get("prop_expl", ""),
                "score": f["prop_score"],
                "game_id": f.get("game_id"),
                "game_label": game_label,
                "game_starts": game_starts,
            })
    picks.sort(key=lambda x: abs(x["score"]), reverse=True)
    return picks[:3]


def build_sms_text(picks: List[dict], header: str = "March Madness Picks") -> str:
    """Format picks as SMS: stat type, selection, game, start time (ET), and short why."""
    lines = [header, ""]
    for i, p in enumerate(picks, 1):
        stat_type = (p.get("type") or "").capitalize()
        lines.append(f"{i}. [{stat_type}] {p.get('selection', 'N/A')}")
        if p.get("game_label"):
            game_line = f"   Game: {p['game_label']}"
            if p.get("game_starts"):
                game_line += f" – starts {p['game_starts']}"
            lines.append(game_line)
        expl = (p.get("explanation") or "")[:70]
        if expl:
            lines.append(f"   Why: {expl}")
        lines.append("")
    return "\n".join(lines).strip()
