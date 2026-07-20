"""Matches + players + teams + result endpoints."""
from fastapi import HTTPException
from datetime import datetime
from typing import Optional

from deps import (
    api_router,
    db,
    MatchCreate,
    PlayerJoin,
    TeamReassign,
    PaymentUpdate,
    RatingUpdate,
    MarkPlayedIn,
    BulkAddIn,
    new_id,
    now_iso,
    token,
    rate_limit,
    get_match_or_404,
    get_players,
    player_share,
    snake_draft,
)
from rating_engine import recalculate_after_match, get_current_rating


@api_router.get("/")
async def root():
    return {"message": "FairXI API"}


@api_router.post("/matches")
async def create_match(m: MatchCreate):
    rate_limit("create_match:global", max_hits=60, window_seconds=60)
    if m.num_teams not in (2, 3, 4):
        raise HTTPException(400, "num_teams must be 2, 3, or 4")
    if m.max_players < 2:
        raise HTTPException(400, "max_players must be >= 2")

    match_id = new_id()
    admin_token = token()

    try:
        dt = datetime.fromisoformat(m.date_time.replace("Z", "+00:00"))
        default_name = f"Match on {dt.strftime('%b %d')}"
    except Exception:
        default_name = "Match"

    doc = {
        "id": match_id,
        "admin_token": admin_token,
        "name": m.name or default_name,
        "date_time": m.date_time,
        "location": m.location,
        "total_cost": float(m.total_cost),
        "max_players": m.max_players,
        "num_teams": m.num_teams,
        "status": "open",
        "mvp_opened_at": None,
        "created_at": now_iso(),
    }
    await db.matches.insert_one(doc)
    return {
        "id": match_id,
        "admin_token": admin_token,
        "public_link": f"/m/{match_id}",
        "admin_link": f"/admin/{match_id}/{admin_token}",
    }


@api_router.get("/matches/{match_id}")
async def get_match(match_id: str):
    match = await get_match_or_404(match_id)
    match.pop("admin_token", None)
    players = await get_players(match_id)
    PUBLIC_FIELDS = {"id", "name", "position", "team_number", "rating"}
    public_players = [
        {k: v for k, v in p.items() if k in PUBLIC_FIELDS} for p in players
    ]
    share = player_share(match, len(players)) if players else round(match["total_cost"] / match["max_players"], 2)
    return {
        "match": match,
        "players": public_players,
        "share_per_player": share,
        "is_full": len(players) >= match["max_players"],
    }


@api_router.get("/matches/{match_id}/admin/{admin_token}")
async def get_match_admin(match_id: str, admin_token: str):
    match = await get_match_or_404(match_id)
    if match["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    players = await get_players(match_id)
    share = player_share(match, len(players)) if players else 0
    return {"match": match, "players": players, "share_per_player": share}


@api_router.post("/matches/{match_id}/join")
async def join_match(match_id: str, p: PlayerJoin):
    rate_limit(f"join:{match_id}", max_hits=30, window_seconds=60)
    match = await get_match_or_404(match_id)
    existing = await get_players(match_id)
    if any(pl["phone"] == p.phone for pl in existing):
        raise HTTPException(400, "You have already joined this match")
    if len(existing) >= match["max_players"]:
        raise HTTPException(400, "Match is full")

    player_doc = {
        "id": new_id(),
        "match_id": match_id,
        "name": p.name.strip(),
        "phone": p.phone.strip(),
        "position": p.position,
        "rating": int(p.rating),
        "team_number": None,
        "paid": False,
        "created_at": now_iso(),
    }
    await db.players.insert_one(player_doc)
    player_doc.pop("_id", None)
    return player_doc


@api_router.delete("/matches/{match_id}/admin/{admin_token}/players/{player_id}")
async def remove_player(match_id: str, admin_token: str, player_id: str):
    match = await get_match_or_404(match_id)
    if match["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    res = await db.players.delete_one({"match_id": match_id, "id": player_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Player not found")
    return {"ok": True}


@api_router.post("/matches/{match_id}/admin/{admin_token}/bulk-add")
async def bulk_add_players(match_id: str, admin_token: str, body: BulkAddIn):
    match = await get_match_or_404(match_id)
    if match["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    existing = await get_players(match_id)
    existing_phones = {p["phone"] for p in existing}
    added, skipped = 0, 0
    slots = match["max_players"] - len(existing)
    for bp in body.players:
        if slots <= 0:
            skipped += 1
            continue
        if bp.phone in existing_phones:
            skipped += 1
            continue
        await db.players.insert_one(
            {
                "id": new_id(),
                "match_id": match_id,
                "name": bp.name.strip(),
                "phone": bp.phone.strip(),
                "position": bp.position,
                "rating": int(bp.rating),
                "team_number": None,
                "paid": False,
                "created_at": now_iso(),
            }
        )
        existing_phones.add(bp.phone)
        added += 1
        slots -= 1
    return {"added": added, "skipped": skipped}


@api_router.post("/matches/{match_id}/admin/{admin_token}/generate-teams")
async def generate_teams(match_id: str, admin_token: str):
    match = await get_match_or_404(match_id)
    if match["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    players = await get_players(match_id)
    if len(players) < 4:
        raise HTTPException(400, "Need at least 4 players to generate teams")

    for p in players:
        p["effective_rating"] = await get_current_rating(db, p["phone"], p.get("rating", 3))

    assigned = snake_draft(players, match["num_teams"])
    for pl in assigned:
        await db.players.update_one(
            {"id": pl["id"]}, {"$set": {"team_number": pl["team_number"]}}
        )
    await db.matches.update_one(
        {"id": match_id}, {"$set": {"status": "teams_generated"}}
    )
    return {"ok": True}


@api_router.patch("/matches/{match_id}/admin/{admin_token}/players/{player_id}/team")
async def reassign_team(match_id: str, admin_token: str, player_id: str, body: TeamReassign):
    match = await get_match_or_404(match_id)
    if match["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    if body.team_number < 1 or body.team_number > match["num_teams"]:
        raise HTTPException(400, "Invalid team number")
    res = await db.players.update_one(
        {"id": player_id, "match_id": match_id},
        {"$set": {"team_number": body.team_number}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Player not found")
    return {"ok": True}


@api_router.patch("/matches/{match_id}/admin/{admin_token}/players/{player_id}/payment")
async def set_payment(match_id: str, admin_token: str, player_id: str, body: PaymentUpdate):
    match = await get_match_or_404(match_id)
    if match["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    res = await db.players.update_one(
        {"id": player_id, "match_id": match_id},
        {"$set": {"paid": body.paid}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Player not found")
    return {"ok": True}


@api_router.patch("/matches/{match_id}/admin/{admin_token}/players/{player_id}/rating")
async def set_rating(match_id: str, admin_token: str, player_id: str, body: RatingUpdate):
    match = await get_match_or_404(match_id)
    if match["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    res = await db.players.update_one(
        {"id": player_id, "match_id": match_id},
        {"$set": {"rating": body.rating}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Player not found")
    return {"ok": True}


@api_router.post("/matches/{match_id}/admin/{admin_token}/mark-played")
async def mark_played(match_id: str, admin_token: str, body: Optional[MarkPlayedIn] = None):
    """Mark match played + record result.

    Idempotent: if rating_history already exists for this match_id, the endpoint
    updates only status + winning_team on the match doc (so the organizer can
    correct a result), but does NOT re-run rating recalculation.
    """
    match = await get_match_or_404(match_id)
    if match["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    winning_team = body.winning_team if body else None
    if winning_team is not None and winning_team > match["num_teams"]:
        raise HTTPException(400, "Winning team out of range")

    already_rated = await db.rating_history.find_one({"match_id": match_id}, {"_id": 0})
    if already_rated:
        await db.matches.update_one(
            {"id": match_id},
            {"$set": {"status": "played", "winning_team": winning_team}},
        )
        prior = await db.rating_history.find({"match_id": match_id}, {"_id": 0}).to_list(200)
        rating_changes = {
            r["phone"]: {
                "old": r["old_rating"],
                "new": r["new_rating"],
                "delta": r["delta"],
                "mvp_votes": r.get("mvp_votes", 0),
            }
            for r in prior
        }
        return {"ok": True, "rating_changes": rating_changes, "recomputed": False}

    await db.matches.update_one(
        {"id": match_id},
        {"$set": {"status": "played", "winning_team": winning_team, "played_at": now_iso()}},
    )
    fresh_match = await get_match_or_404(match_id)
    players = await get_players(match_id)
    rating_changes = await recalculate_after_match(db, fresh_match, players)
    return {"ok": True, "rating_changes": rating_changes, "recomputed": True}
