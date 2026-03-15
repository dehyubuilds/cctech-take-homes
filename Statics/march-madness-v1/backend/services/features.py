"""
Compute feature vectors and simple scores for spread, total, prop.
Deterministic, explainable. No ML.
"""
from typing import Any, Dict, List
from .normalize import normalize_team_stats, normalize_player_stats, normalize_game

def _safe_float(x: Any) -> float:
    try:
        return float(x) if x is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

def score_spread_edge(
    home_team_stats: dict,
    away_team_stats: dict,
    game: dict,
) -> tuple[float, str]:
    """
    Simple spread edge: efficiency margin + turnover edge.
    Returns (score, explanation).
    """
    h = normalize_team_stats(home_team_stats)
    a = normalize_team_stats(away_team_stats)
    eff_margin = (h["off_eff"] - h["def_eff"]) - (a["off_eff"] - a["def_eff"])
    to_edge = a["turnover_pct"] - h["turnover_pct"]  # higher away TO = home edge
    score = eff_margin * 0.1 + to_edge * 2.0
    expl = f"Efficiency margin and turnover edge (home off_eff {h['off_eff']:.1f}, away to_pct {a['turnover_pct']:.1f})"
    return (score, expl)

def score_total_edge(
    home_team_stats: dict,
    away_team_stats: dict,
    game: dict,
    line: float = 140.0,
) -> tuple[float, str]:
    """
    Total (over/under) edge: pace and shot volume project above/below line.
    """
    h = normalize_team_stats(home_team_stats)
    a = normalize_team_stats(away_team_stats)
    pace = (h["pace"] + a["pace"]) / 2.0 if (h["pace"] + a["pace"]) > 0 else 70.0
    # Simple projection: pace correlates with points
    projected = pace * 2.0 + (h["off_eff"] + a["off_eff"]) * 0.3
    edge = projected - line
    expl = f"Pace and shot volume project above market (avg pace {pace:.1f}, line {line})"
    return (edge, expl)

def score_prop_edge(
    player_stats: dict,
    team_stats: dict,
    opponent_def_three_pct: float,
    line: float = 2.5,
) -> tuple[float, str]:
    """
    Player prop (e.g. 3PA): recent volume vs opponent perimeter defense.
    """
    three_pa = _safe_float(player_stats.get("three_pa", player_stats.get("fg3a", 0)))
    three_pct = _safe_float(player_stats.get("three_pct", 0))
    # Weak perimeter = higher volume
    adj = (1.2 - opponent_def_three_pct / 100.0) if opponent_def_three_pct else 1.0
    projected = three_pa * adj
    edge = projected - line
    expl = f"High recent 3PA volume vs weak perimeter defense (3PA {three_pa:.1f}, line {line})"
    return (edge, expl)

def build_game_features(
    game: dict,
    home_stats: dict,
    away_stats: dict,
    home_players: list,
    away_players: list,
) -> dict:
    """One game feature bundle for ranking."""
    g = normalize_game(game)
    spread_score, spread_expl = score_spread_edge(home_stats, away_stats, g)
    total_score, total_expl = score_total_edge(home_stats, away_stats, g)
    # Best prop from home/away players
    prop_score, prop_expl = 0.0, ""
    if home_players or away_players:
        all_players = normalize_player_stats(home_players + away_players)
        for p in sorted(all_players, key=lambda x: x["three_pa"], reverse=True)[:1]:
            ps, pe = score_prop_edge(p, {}, 0.0, 2.5)
            if ps > prop_score:
                prop_score, prop_expl = ps, pe
    return {
        "game_id": g["game_id"],
        "home": g["home_team_name"],
        "away": g["away_team_name"],
        "game_date": g.get("date", ""),
        "game_start_time": g.get("start_time", ""),
        "spread_score": spread_score,
        "spread_expl": spread_expl,
        "total_score": total_score,
        "total_expl": total_expl,
        "prop_score": prop_score,
        "prop_expl": prop_expl,
    }
