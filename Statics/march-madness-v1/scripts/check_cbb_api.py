#!/usr/bin/env python3
"""Quick check: can we reach the CBB API for game data? Run from repo root: python3 scripts/check_cbb_api.py"""
import sys
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))
os.chdir(ROOT)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
except ImportError:
    pass

from services import cbb_data

if __name__ == "__main__":
    try:
        games = cbb_data.get_todays_games()
        n = len(games) if isinstance(games, list) else 0
        sys.stdout.write("CBB API: OK | games_today=%d\n" % n)
        sys.exit(0)
    except Exception as e:
        sys.stderr.write("CBB API: FAIL | %s\n" % (str(e)[:200]))
        sys.exit(1)
