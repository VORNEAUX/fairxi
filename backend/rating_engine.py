"""FairXI dynamic rating engine — lightweight Elo-inspired, 1.0–5.0 scale.

- Players carry a per-match seed rating (1–5, self-declared).
- After a match is marked with a result, each player's dynamic rating is
  recomputed as: current + K * (actual - expected(current, opp_avg)) + mvp_bonus
- Dynamic ratings live in db.player_stats and are keyed by phone.
- Every recompute writes a row to db.rating_history for trend display.
"""
from __future__ import annotations
from typing import List, Dict, Optional
from datetime import datetime, timezone

K = 0.15
MVP_BONUS = 0.05
MIN_R = 1.0
MAX_R = 5.0


def expected_score(self_r: float, opp_avg: float) -> float:
    return 1.0 / (1.0 + 10 ** ((opp_avg - self_r) / 1.5))


def actual_for(team_number: Optional[int], winning_team: Optional[int]) -> float:
    """1.0 win, 0.5 draw, 0.0 loss."""
    if winning_team is None:
        return 0.5
    if team_number is None:
        return 0.0
    return 1.0 if team_number == winning_team else 0.0


def clamp(v: float) -> float:
    return max(MIN_R, min(MAX_R, round(v, 2)))


def compute_delta(current: float, actual: float, opp_avg: float, mvp_votes: int) -> float:
    exp = expected_score(current, opp_avg)
    delta = K * (actual - exp) + MVP_BONUS * mvp_votes
    return round(delta, 3)


async def get_current_rating(db, phone: str, fallback_seed: int) -> float:
    """Return dynamic rating for the phone if it exists, else the seed value."""
    doc = await db.player_stats.find_one({"phone": phone}, {"_id": 0})
    if doc and "current_rating" in doc:
        return float(doc["current_rating"])
    return float(fallback_seed)


async def recalculate_after_match(db, match: dict, players: List[dict]) -> Dict[str, dict]:
    """Recompute ratings for every player in the match.

    Returns {phone: {old, new, delta}} for the UI/report to display.
    """
    winning_team = match.get("winning_team")  # int or None (draw)

    # 1) Snapshot current ratings from stats (or seed)
    currents: Dict[str, float] = {}
    for p in players:
        currents[p["phone"]] = await get_current_rating(db, p["phone"], p.get("rating", 3))

    # 2) MVP vote tallies for the match
    vote_rows = await db.mvp_votes.find({"match_id": match["id"]}, {"_id": 0}).to_list(1000)
    votes_for: Dict[str, int] = {}
    for v in vote_rows:
        pid = v["vote_for_player_id"]
        votes_for[pid] = votes_for.get(pid, 0) + 1

    # 3) Team average ratings (using CURRENT ratings, not seeds)
    teams: Dict[int, List[str]] = {}  # team_number -> [phone]
    for p in players:
        t = p.get("team_number")
        if t is None:
            continue
        teams.setdefault(t, []).append(p["phone"])
    team_avg: Dict[int, float] = {}
    for t, phones in teams.items():
        vals = [currents[ph] for ph in phones]
        team_avg[t] = round(sum(vals) / len(vals), 2) if vals else 3.0

    # 4) Compute per-player delta and persist
    results: Dict[str, dict] = {}
    now = datetime.now(timezone.utc).isoformat()
    for p in players:
        phone = p["phone"]
        team = p.get("team_number")
        current = currents[phone]
        if team is None:
            # Player was never placed on a team (edge case) — skip rating change
            results[phone] = {"old": current, "new": current, "delta": 0.0, "skipped": True}
            continue
        # Opponent avg = average of the OTHER teams' averages, weighted by size
        opp_phones = [ph for t2, phs in teams.items() if t2 != team for ph in phs]
        opp_avg = (
            round(sum(currents[ph] for ph in opp_phones) / len(opp_phones), 2)
            if opp_phones
            else current
        )
        actual = actual_for(team, winning_team)
        mvp_votes = votes_for.get(p["id"], 0)
        delta = compute_delta(current, actual, opp_avg, mvp_votes)
        new_val = clamp(current + delta)

        # Upsert player_stats
        stats_update = {
            "phone": phone,
            "name": p["name"],
            "current_rating": new_val,
            "last_played_at": now,
        }
        await db.player_stats.update_one(
            {"phone": phone},
            {
                "$set": stats_update,
                "$inc": {"matches_played": 1, "mvp_votes_received": mvp_votes},
            },
            upsert=True,
        )
        # Rating history log
        await db.rating_history.insert_one(
            {
                "phone": phone,
                "match_id": match["id"],
                "group_id": match.get("group_id"),
                "old_rating": current,
                "new_rating": new_val,
                "delta": round(new_val - current, 3),
                "opp_avg": opp_avg,
                "actual": actual,
                "mvp_votes": mvp_votes,
                "created_at": now,
            }
        )
        results[phone] = {
            "old": current,
            "new": new_val,
            "delta": round(new_val - current, 3),
            "actual": actual,
            "mvp_votes": mvp_votes,
        }
    return results
