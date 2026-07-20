"""Player-scoped endpoints (history + rating history)."""
from fastapi import HTTPException

from deps import api_router, db


@api_router.get("/players/{phone}/rating-history")
async def player_rating_history(phone: str, limit: int = 30):
    rows = (
        await db.rating_history.find({"phone": phone}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(min(limit, 100))
    )
    stats = await db.player_stats.find_one({"phone": phone}, {"_id": 0})
    return {
        "phone": phone,
        "current_rating": stats["current_rating"] if stats else None,
        "matches_played": stats.get("matches_played", 0) if stats else 0,
        "history": list(reversed(rows)),
    }


@api_router.get("/history/{phone}")
async def player_history(phone: str):
    entries = await db.players.find({"phone": phone}, {"_id": 0}).to_list(1000)
    if not entries:
        return {
            "phone": phone,
            "matches_played": 0,
            "average_rating": 0,
            "mvp_count": 0,
            "matches": [],
        }
    mvp_count = 0
    match_summaries = []
    for e in entries:
        votes = await db.mvp_votes.find({"match_id": e["match_id"]}, {"_id": 0}).to_list(1000)
        tally = {}
        for v in votes:
            tally[v["vote_for_player_id"]] = tally.get(v["vote_for_player_id"], 0) + 1
        top = max(tally.values()) if tally else 0
        was_mvp = top > 0 and tally.get(e["id"], 0) == top
        if was_mvp:
            mvp_count += 1
        m = await db.matches.find_one({"id": e["match_id"]}, {"_id": 0})
        if m:
            match_summaries.append(
                {
                    "match_id": m["id"],
                    "match_name": m["name"],
                    "date_time": m["date_time"],
                    "rating": e["rating"],
                    "was_mvp": was_mvp,
                }
            )
    avg_rating = round(sum(e["rating"] for e in entries) / len(entries), 2)
    return {
        "phone": phone,
        "name": entries[-1]["name"],
        "matches_played": len(entries),
        "average_rating": avg_rating,
        "mvp_count": mvp_count,
        "matches": match_summaries,
    }


@api_router.get("/demo")
async def get_demo():
    m = await db.matches.find_one({"is_demo": True}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Demo not seeded")
    return {"match_id": m["id"]}
