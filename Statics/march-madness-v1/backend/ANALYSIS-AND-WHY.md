# How the "Why" / analysis is determined

We **do** have analysis in-app. It is **rule-based and deterministic** (no ML, no external analysis API). The same code that computes the pick score also produces the explanation string.

## Flow

1. **Inputs**: College Basketball Data API gives us team season stats and player season stats (efficiency, pace, turnover %, 3PT, etc.). `normalize.py` maps API field names into a single shape (`off_eff`, `def_eff`, `pace`, `turnover_pct`, etc.).

2. **Scoring**: In `services/features.py`, three functions compute an **edge score** and an **explanation string**:
   - **Spread** (`score_spread_edge`): efficiency margin (home vs away) + turnover edge → `(score, explanation)`.
   - **Total** (`score_total_edge`): pace + offensive efficiency vs a fixed line (140) → `(score, explanation)`.
   - **Prop** (`score_prop_edge`): player 3PA volume vs line (2.5), adjusted by opponent perimeter D → `(score, explanation)`.

3. **Explanations**: Each function returns a **hardcoded template** filled with the actual numbers used in the formula. Examples:

   | Pick type | How the "Why" is built |
   |-----------|-------------------------|
   | **Spread** | `f"Efficiency margin and turnover edge (home off_eff {h['off_eff']:.1f}, away to_pct {a['turnover_pct']:.1f})"` — so the SMS shows the home offensive efficiency and away turnover % that drove the score. |
   | **Total** | `f"Pace and shot volume project above market (avg pace {pace:.1f}, line {line})"` — shows the average pace and the line we compared to. |
   | **Prop** | `f"High recent 3PA volume vs weak perimeter defense (3PA {three_pa:.1f}, line {line})"` — shows the player’s 3PA and the line. |

4. **Ranking**: `ranking.rank_edges()` takes the feature list, keeps each pick’s `explanation` from the feature dict, and sorts by `abs(score)` to pick the top 3.

5. **SMS**: `build_sms_text()` uses each pick’s `explanation` and truncates it to **70 characters** for the "Why:" line.

So the analysis is: **we compute the edge with a formula and at the same time build a short, deterministic "why" from the same inputs.** There is no separate "analysis engine"; the logic lives in `services/features.py` (and the numbers come from the CBB API via `normalize.py`).

## Where to change it

- **Different or longer "Why" text**: Edit the `expl` strings in `score_spread_edge`, `score_total_edge`, and `score_prop_edge` in `services/features.py`. The 70-char limit is in `ranking.build_sms_text()` (change `[:70]` if you want longer).
- **Different stats or logic**: Change the formulas in those same functions and update the explanation templates to match the new inputs (e.g. include pace, def_eff, or player name).
