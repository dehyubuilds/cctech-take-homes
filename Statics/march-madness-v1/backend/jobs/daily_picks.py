"""
Daily workflow: load games, compute picks, store, send SMS to allowed numbers.
New subscribers get a welcome SMS first (games today + what to expect), then daily picks.
"""
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List

import boto3
from services import cbb_data, statics_source
from services.features import build_game_features
from services.ranking import rank_edges, build_sms_text
from sms import send_bulk_sms

WELCOME_MSG_GAMES = (
    "Welcome to March Madness Picks! Today there are %d game(s). "
    "We'll text you daily with: top spread & total picks, game matchups, start times (ET), and short reasons. "
    "One message per day. Reply STOP to opt out."
)
WELCOME_MSG_NO_GAMES = (
    "Welcome to March Madness Picks! No games today. "
    "We'll text you daily with: top spread & total picks, game matchups, start times (ET), and short reasons. "
    "One message per day when games are on. Reply STOP to opt out."
)

def _welcome_sent_table(region: str) -> str:
    return os.environ.get("WELCOME_SENT_TABLE", "march_madness_welcome_sent")

def _has_received_welcome(dynamo, table: str, phone: str) -> bool:
    try:
        r = dynamo.get_item(
            TableName=table,
            Key={"phone": {"S": phone}},
        )
        return "Item" in r and r.get("Item")
    except Exception:
        return True  # on error, skip welcome to avoid duplicate sends

def _mark_welcome_sent(dynamo, table: str, phone: str) -> None:
    try:
        dynamo.put_item(
            TableName=table,
            Item={
                "phone": {"S": phone},
                "sent_at": {"S": datetime.utcnow().isoformat() + "Z"},
            },
        )
    except Exception:
        pass

def run_daily_picks() -> dict:
    """
    Load today's games, compute predictions, rank, build SMS, load allowed numbers, send, store.
    Returns { message, picks, sent_count, stored }.
    """
    region = os.environ.get("AWS_REGION", "us-east-1")
    daily_table = os.environ.get("DAILY_PICKS_TABLE", "march_madness_daily_picks")
    log_table = os.environ.get("PREDICTIONS_LOG_TABLE", "march_madness_predictions_log")

    pick_date = datetime.utcnow().strftime("%Y-%m-%d")
    features_list: List[dict] = []

    try:
        games = cbb_data.get_todays_games()
    except Exception as e:
        return {
            "message": f"No games or API error: {e}",
            "picks": [],
            "sent_count": 0,
            "stored": False,
            "error": str(e),
        }

    if not games:
        msg = "March Madness Picks\n\nNo games today."
        _store_daily_picks(region, daily_table, pick_date, msg, [])
        picks = []
        message = msg
    else:
        for g in games[:10]:  # limit slate size
            try:
                game = g if isinstance(g, dict) else {}
                home_id = str(game.get("home_team_id", game.get("home_team", "")))
                away_id = str(game.get("away_team_id", game.get("away_team", "")))
                if not home_id or not away_id:
                    continue
                home_stats = cbb_data.get_team_stats(home_id)
                away_stats = cbb_data.get_team_stats(away_id)
                home_players = cbb_data.get_player_stats(home_id)
                away_players = cbb_data.get_player_stats(away_id)
                feats = build_game_features(
                    game, home_stats, away_stats,
                    home_players or [], away_players or [],
                )
                features_list.append(feats)
            except Exception:
                continue
        picks = rank_edges(features_list)
        message = build_sms_text(picks)

    dynamo = boto3.client("dynamodb", region_name=region)

    for p in picks:
        try:
            dynamo.put_item(
                TableName=log_table,
                Item={
                    "prediction_id": {"S": str(uuid.uuid4())},
                    "pick_date": {"S": pick_date},
                    "game_id": {"S": str(p.get("game_id", ""))},
                    "market_type": {"S": p.get("type", "")},
                    "selection": {"S": p.get("selection", "")},
                    "predicted_value": {"N": "0"},
                    "confidence_score": {"N": str(p.get("score", 0))},
                    "explanation": {"S": p.get("explanation", "")},
                    "features": {"S": "{}"},
                    "created_at": {"S": datetime.utcnow().isoformat() + "Z"},
                },
            )
        except Exception:
            pass

    # Store daily picks
    _store_daily_picks(region, daily_table, pick_date, message, picks)

    # Allowed numbers: send welcome to new subscribers, then daily picks to all
    numbers = statics_source.get_march_madness_allowed_numbers()
    sent_count = 0
    welcome_table = _welcome_sent_table(region)
    welcome_msg = WELCOME_MSG_GAMES % len(games) if games else WELCOME_MSG_NO_GAMES

    for phone in numbers or []:
        if not _has_received_welcome(dynamo, welcome_table, phone):
            try:
                send_bulk_sms([phone], welcome_msg)
                _mark_welcome_sent(dynamo, welcome_table, phone)
            except Exception:
                pass
        if message:
            try:
                results = send_bulk_sms([phone], message)
                if results and isinstance(results[0][1], str) and not results[0][1].startswith("Error"):
                    sent_count += 1
            except Exception:
                pass

    return {
        "message": message,
        "picks": picks,
        "sent_count": sent_count,
        "stored": True,
        "allowed_count": len(numbers) if numbers else 0,
    }

def _store_daily_picks(region: str, table: str, pick_date: str, message: str, picks: list):
    import json
    dynamo = boto3.client("dynamodb", region_name=region)
    try:
        dynamo.put_item(
            TableName=table,
            Item={
                "pick_date": {"S": pick_date},
                "message": {"S": message},
                "picks": {"S": json.dumps(picks)},
                "model_version": {"S": "v1"},
                "created_at": {"S": datetime.utcnow().isoformat() + "Z"},
            },
        )
    except Exception:
        pass
