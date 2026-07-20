"""MVP voting endpoints."""
from fastapi import HTTPException

from deps import (
    api_router,
    db,
    MVPVerifyIn,
    MVPVoteIn,
    new_id,
    now_iso,
    rate_limit,
    get_match_or_404,
    get_players,
    is_voting_closed,
)


@api_router.post("/matches/{match_id}/admin/{admin_token}/open-mvp")
async def open_mvp(match_id: str, admin_token: str):
    match = await get_match_or_404(match_id)
    if match["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    if match["status"] not in ("played", "mvp_voting_open"):
        raise HTTPException(400, "Match must be marked as played first")
    await db.matches.update_one(
        {"id": match_id},
        {"$set": {"status": "mvp_voting_open", "mvp_opened_at": now_iso()}},
    )
    return {"ok": True}


@api_router.post("/matches/{match_id}/mvp/verify")
async def verify_voter(match_id: str, body: MVPVerifyIn):
    """Look up the voter by phone without leaking other players' phones."""
    await get_match_or_404(match_id)
    voter = await db.players.find_one(
        {"match_id": match_id, "phone": body.phone.strip()}, {"_id": 0}
    )
    if not voter:
        raise HTTPException(404, "You did not join this match")
    return {
        "id": voter["id"],
        "name": voter["name"],
        "team_number": voter.get("team_number"),
        "position": voter["position"],
    }


@api_router.post("/matches/{match_id}/mvp/vote")
async def cast_mvp_vote(match_id: str, body: MVPVoteIn):
    rate_limit(f"vote:{match_id}", max_hits=60, window_seconds=60)
    match = await get_match_or_404(match_id)
    if is_voting_closed(match):
        raise HTTPException(400, "Voting is closed")
    voter = await db.players.find_one(
        {"match_id": match_id, "phone": body.voter_phone}, {"_id": 0}
    )
    if not voter:
        raise HTTPException(404, "You did not join this match")
    target = await db.players.find_one(
        {"match_id": match_id, "id": body.vote_for_player_id}, {"_id": 0}
    )
    if not target:
        raise HTTPException(404, "Player to vote for not found")
    if target["id"] == voter["id"]:
        raise HTTPException(400, "You cannot vote for yourself")
    if voter.get("team_number") and target.get("team_number") and voter["team_number"] != target["team_number"]:
        raise HTTPException(400, "You may only vote for a teammate")
    existing = await db.mvp_votes.find_one({"match_id": match_id, "voter_id": voter["id"]})
    if existing:
        raise HTTPException(400, "You have already voted")
    await db.mvp_votes.insert_one(
        {
            "id": new_id(),
            "match_id": match_id,
            "voter_id": voter["id"],
            "voter_phone": voter["phone"],
            "vote_for_player_id": target["id"],
            "created_at": now_iso(),
        }
    )
    return {"ok": True}


@api_router.get("/matches/{match_id}/mvp/results")
async def mvp_results(match_id: str):
    match = await get_match_or_404(match_id)
    votes = await db.mvp_votes.find({"match_id": match_id}, {"_id": 0}).to_list(1000)
    players = await get_players(match_id)
    tally = {}
    for v in votes:
        tally[v["vote_for_player_id"]] = tally.get(v["vote_for_player_id"], 0) + 1
    results = []
    for p in players:
        results.append(
            {
                "player_id": p["id"],
                "name": p["name"],
                "team_number": p.get("team_number"),
                "votes": tally.get(p["id"], 0),
            }
        )
    results.sort(key=lambda r: -r["votes"])
    mvp = results[0] if results and results[0]["votes"] > 0 else None
    return {
        "results": results,
        "mvp": mvp,
        "voting_closed": is_voting_closed(match),
        "opened_at": match.get("mvp_opened_at"),
    }
