from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta

from rating_engine import (
    recalculate_after_match,
    get_current_rating,
)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

Position = Literal["Goalkeeper", "Defender", "Midfielder", "Forward"]
MatchStatus = Literal["open", "teams_generated", "played", "mvp_voting_open", "completed"]


# ---------- MODELS ----------
class MatchCreate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    date_time: str = Field(max_length=64)
    location: str = Field(min_length=1, max_length=120)
    total_cost: float = Field(ge=0, le=100000)
    max_players: int = Field(ge=2, le=64)
    num_teams: int = 2


class PlayerJoin(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    phone: str = Field(min_length=3, max_length=32)
    position: Position
    rating: int = Field(ge=1, le=5)


class TeamReassign(BaseModel):
    team_number: int


class PaymentUpdate(BaseModel):
    paid: bool


class RatingUpdate(BaseModel):
    rating: int = Field(ge=1, le=5)


class MarkPlayedIn(BaseModel):
    winning_team: Optional[int] = Field(default=None, ge=1, le=8)  # None = draw


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class GroupMatchCreate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    date_time: str = Field(max_length=64)
    location: str = Field(min_length=1, max_length=120)
    total_cost: float = Field(ge=0, le=100000)
    max_players: int = Field(ge=2, le=64)
    num_teams: int = 2


class MVPVoteIn(BaseModel):
    voter_phone: str = Field(min_length=3, max_length=32)
    vote_for_player_id: str = Field(min_length=1, max_length=64)


class BulkPlayer(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    phone: str = Field(min_length=3, max_length=32)
    position: Position
    rating: int = Field(ge=1, le=5)


class BulkAddIn(BaseModel):
    players: List[BulkPlayer]


class MVPVerifyIn(BaseModel):
    phone: str = Field(min_length=3, max_length=32)


# ---------- HELPERS ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def token() -> str:
    # 24 bytes → 32 url-safe chars, ~192 bits of entropy — safe to share in URLs
    return secrets.token_urlsafe(24)


# Very small in-memory rate limiter — sufficient for a single-process deployment
# to blunt obvious abuse (join spam, vote spam, match-create flood). For multi-worker
# production, put a proper limiter (nginx/redis) in front of this app.
_RATE_BUCKETS: dict = {}


def rate_limit(key: str, max_hits: int, window_seconds: int) -> None:
    now = datetime.now(timezone.utc).timestamp()
    hits = [t for t in _RATE_BUCKETS.get(key, []) if now - t < window_seconds]
    if len(hits) >= max_hits:
        raise HTTPException(429, "Too many requests, please slow down")
    hits.append(now)
    _RATE_BUCKETS[key] = hits


def scrub(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def snake_draft(players: List[dict], num_teams: int) -> List[dict]:
    """Sort players by effective rating desc, then snake-draft across N teams.
    Secondary: light position variety without breaking sort order.

    Uses `effective_rating` if present (dynamic rating), else falls back to `rating` (seed).
    """
    def eff(p):
        return float(p.get("effective_rating", p.get("rating", 3)))

    sorted_players = sorted(players, key=lambda p: (-eff(p), p["name"]))
    assignments: List[List[dict]] = [[] for _ in range(num_teams)]

    # First pass: pure snake draft by effective rating
    order = []
    forward = True
    idx = 0
    while idx < len(sorted_players):
        team_order = list(range(num_teams)) if forward else list(range(num_teams - 1, -1, -1))
        for t in team_order:
            if idx >= len(sorted_players):
                break
            order.append(t)
            idx += 1
        forward = not forward

    result_players = []
    for i, p in enumerate(sorted_players):
        team = order[i]
        result_players.append({**p, "team_number": team + 1})

    def team_positions(team_idx):
        return [rp["position"] for rp in result_players if rp["team_number"] == team_idx + 1]

    # Position variety secondary pass — only swap when ratings are close enough
    # not to hurt balance (rounded to 0.5) AND swap improves diversity.
    for i in range(len(result_players) - 1):
        a = result_players[i]
        b = result_players[i + 1]
        if a["team_number"] == b["team_number"]:
            continue
        if abs(eff(a) - eff(b)) > 0.4:
            continue
        ta = team_positions(a["team_number"] - 1)
        tb = team_positions(b["team_number"] - 1)
        stack_now = ta.count(a["position"]) + tb.count(b["position"])
        ta2 = [x for x in ta if x != a["position"]] + [b["position"]]
        tb2 = [x for x in tb if x != b["position"]] + [a["position"]]
        stack_after = ta2.count(b["position"]) + tb2.count(a["position"])
        if stack_after < stack_now:
            a["team_number"], b["team_number"] = b["team_number"], a["team_number"]

    return result_players


async def get_match_or_404(match_id: str) -> dict:
    m = await db.matches.find_one({"id": match_id})
    if not m:
        raise HTTPException(404, "Match not found")
    return scrub(m)


async def get_players(match_id: str) -> List[dict]:
    cursor = db.players.find({"match_id": match_id}, {"_id": 0})
    return await cursor.to_list(500)


def player_share(match: dict, num_players: int) -> float:
    if num_players <= 0:
        return 0.0
    return round(match["total_cost"] / num_players, 2)


# ---------- ROUTES ----------
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

    # default name
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
    # Public view: strip phone (PII) and paid status. Keep only what the join page needs.
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
    return {
        "match": match,
        "players": players,
        "share_per_player": share,
    }


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
    scrub(player_doc)
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

    # Inject effective_rating (dynamic if known, else seed) so the draft uses it.
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
    match = await get_match_or_404(match_id)
    if match["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    winning_team = body.winning_team if body else None
    if winning_team is not None and winning_team > match["num_teams"]:
        raise HTTPException(400, "Winning team out of range")

    # Persist result and mark played
    await db.matches.update_one(
        {"id": match_id},
        {"$set": {"status": "played", "winning_team": winning_team, "played_at": now_iso()}},
    )
    # Recalculate dynamic ratings for every player who was placed on a team.
    fresh_match = await get_match_or_404(match_id)
    players = await get_players(match_id)
    rating_changes = await recalculate_after_match(db, fresh_match, players)
    return {"ok": True, "rating_changes": rating_changes}


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
        "history": list(reversed(rows)),  # oldest → newest for sparkline
    }


# ---------- GROUPS ----------
@api_router.post("/groups")
async def create_group(body: GroupCreate):
    gid = new_id()
    admin_token = token()
    doc = {
        "id": gid,
        "admin_token": admin_token,
        "name": body.name.strip(),
        "created_at": now_iso(),
    }
    await db.groups.insert_one(doc)
    return {"id": gid, "admin_token": admin_token, "name": body.name.strip()}


async def get_group_or_404(group_id: str) -> dict:
    g = await db.groups.find_one({"id": group_id})
    if not g:
        raise HTTPException(404, "Group not found")
    return scrub(g)


@api_router.get("/groups/{group_id}/admin/{admin_token}")
async def get_group_dashboard(group_id: str, admin_token: str):
    g = await get_group_or_404(group_id)
    if g["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    # matches in this group, most recent first
    matches = (
        await db.matches.find({"group_id": group_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )
    # Aggregate stats across group
    match_ids = [m["id"] for m in matches]
    players_across = (
        await db.players.find({"match_id": {"$in": match_ids}}, {"_id": 0}).to_list(5000)
    )
    votes_across = (
        await db.mvp_votes.find({"match_id": {"$in": match_ids}}, {"_id": 0}).to_list(5000)
    )

    # Standings per phone: wins/draws/losses/matches, mvp_count, current_rating
    by_phone: dict = {}
    for p in players_across:
        by_phone.setdefault(p["phone"], {
            "phone": p["phone"],
            "name": p["name"],
            "matches": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "mvp_count": 0,
        })
    # Compute per match outcome per player
    match_by_id = {m["id"]: m for m in matches}
    for p in players_across:
        m = match_by_id.get(p["match_id"])
        if not m or m.get("status") not in ("played", "completed", "mvp_voting_open"):
            continue
        # If result was set (winning_team key exists) count outcome
        if "winning_team" not in m or p.get("team_number") is None:
            continue
        wt = m.get("winning_team")
        rec = by_phone[p["phone"]]
        rec["matches"] += 1
        if wt is None:
            rec["draws"] += 1
        elif wt == p["team_number"]:
            rec["wins"] += 1
        else:
            rec["losses"] += 1

    # MVP tallies per match: only top-vote counts
    for m in matches:
        vs = [v for v in votes_across if v["match_id"] == m["id"]]
        if not vs:
            continue
        tally: dict = {}
        for v in vs:
            tally[v["vote_for_player_id"]] = tally.get(v["vote_for_player_id"], 0) + 1
        top = max(tally.values()) if tally else 0
        winners = [pid for pid, c in tally.items() if c == top and top > 0]
        for pid in winners:
            pl = next((p for p in players_across if p["id"] == pid), None)
            if pl and pl["phone"] in by_phone:
                by_phone[pl["phone"]]["mvp_count"] += 1

    # Attach current dynamic rating from stats
    phones = list(by_phone.keys())
    stats_rows = await db.player_stats.find({"phone": {"$in": phones}}, {"_id": 0}).to_list(2000)
    stats_by_phone = {s["phone"]: s for s in stats_rows}
    for phone, rec in by_phone.items():
        s = stats_by_phone.get(phone)
        rec["current_rating"] = s["current_rating"] if s else None

    standings = sorted(
        by_phone.values(),
        key=lambda r: (
            -(r["wins"] * 3 + r["draws"]),
            -(r["current_rating"] or 0),
            -r["mvp_count"],
        ),
    )
    mvp_board = sorted(
        by_phone.values(), key=lambda r: (-r["mvp_count"], -(r["current_rating"] or 0))
    )[:20]

    # Rating top-gainers within the group
    rh_rows = await db.rating_history.find(
        {"group_id": group_id}, {"_id": 0}
    ).to_list(5000)
    gain_by_phone: dict = {}
    for r in rh_rows:
        gain_by_phone[r["phone"]] = gain_by_phone.get(r["phone"], 0) + r["delta"]
    top_gainers = sorted(
        [
            {
                "phone": ph,
                "name": by_phone.get(ph, {}).get("name", "—"),
                "gain": round(gain, 2),
                "current_rating": by_phone.get(ph, {}).get("current_rating"),
            }
            for ph, gain in gain_by_phone.items()
            if ph in by_phone
        ],
        key=lambda r: -r["gain"],
    )[:10]

    return {
        "group": g,
        "matches": matches,
        "standings": standings,
        "mvp_leaderboard": mvp_board,
        "top_gainers": top_gainers,
    }


@api_router.post("/groups/{group_id}/admin/{admin_token}/matches")
async def create_group_match(group_id: str, admin_token: str, m: GroupMatchCreate):
    rate_limit("create_match:global", max_hits=60, window_seconds=60)
    g = await get_group_or_404(group_id)
    if g["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    if m.num_teams not in (2, 3, 4):
        raise HTTPException(400, "num_teams must be 2, 3, or 4")

    match_id = new_id()
    match_admin_token = token()
    try:
        dt = datetime.fromisoformat(m.date_time.replace("Z", "+00:00"))
        default_name = f"Match on {dt.strftime('%b %d')}"
    except Exception:
        default_name = "Match"
    doc = {
        "id": match_id,
        "admin_token": match_admin_token,
        "group_id": group_id,
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
        "admin_token": match_admin_token,
        "group_id": group_id,
        "public_link": f"/m/{match_id}",
        "admin_link": f"/admin/{match_id}/{match_admin_token}",
    }


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


def is_voting_closed(match: dict) -> bool:
    if match["status"] == "completed":
        return True
    if match["status"] != "mvp_voting_open":
        return True
    opened = match.get("mvp_opened_at")
    if not opened:
        return True
    opened_dt = datetime.fromisoformat(opened)
    return datetime.now(timezone.utc) - opened_dt > timedelta(hours=24)


@api_router.post("/matches/{match_id}/mvp/verify")
async def verify_voter(match_id: str, body: MVPVerifyIn):
    """Look up the voter by phone and return only their own player record.
    Prevents leaking all players' phones via the public list."""
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


@api_router.get("/history/{phone}")
async def player_history(phone: str):
    entries = await db.players.find({"phone": phone}, {"_id": 0}).to_list(1000)
    if not entries:
        return {"phone": phone, "matches_played": 0, "average_rating": 0, "mvp_count": 0, "matches": []}
    match_ids = [e["match_id"] for e in entries]
    mvp_count = 0
    match_summaries = []
    for e in entries:
        # count if this player got most votes for the match
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


# ---------- APP WIRING ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def seed_demo():
    """Seed a single demo match on first startup."""
    existing = await db.matches.find_one({"is_demo": True})
    if existing:
        return

    match_id = new_id()
    admin_token = token()
    dt = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    match_doc = {
        "id": match_id,
        "is_demo": True,
        "admin_token": admin_token,
        "name": "Friday Night 5-a-Side",
        "date_time": dt,
        "location": "Riverside Astro Pitch",
        "total_cost": 100.0,
        "max_players": 10,
        "num_teams": 2,
        "status": "mvp_voting_open",
        "mvp_opened_at": now_iso(),
        "created_at": now_iso(),
    }
    await db.matches.insert_one(match_doc)

    seed_players = [
        ("Alex", "5551000001", "Goalkeeper", 4, 1, True),
        ("Ben", "5551000002", "Defender", 5, 1, True),
        ("Carlos", "5551000003", "Midfielder", 4, 1, False),
        ("Dan", "5551000004", "Forward", 3, 1, True),
        ("Ethan", "5551000005", "Defender", 3, 1, False),
        ("Finn", "5551000006", "Goalkeeper", 4, 2, True),
        ("Gabe", "5551000007", "Midfielder", 5, 2, True),
        ("Hugo", "5551000008", "Forward", 4, 2, False),
        ("Ivan", "5551000009", "Defender", 3, 2, True),
        ("Jack", "5551000010", "Midfielder", 2, 2, False),
    ]
    player_ids = {}
    for name, phone, pos, rating, team, paid in seed_players:
        pid = new_id()
        player_ids[name] = pid
        await db.players.insert_one(
            {
                "id": pid,
                "match_id": match_id,
                "name": name,
                "phone": phone,
                "position": pos,
                "rating": rating,
                "team_number": team,
                "paid": paid,
                "created_at": now_iso(),
            }
        )

    # Pre-seed some MVP votes so demo already shows an MVP result.
    votes = [
        ("Alex", "Ben"),
        ("Carlos", "Ben"),
        ("Dan", "Ben"),
        ("Ethan", "Ben"),
        ("Finn", "Gabe"),
        ("Hugo", "Gabe"),
        ("Ivan", "Gabe"),
        ("Jack", "Gabe"),
        ("Ben", "Carlos"),
        ("Gabe", "Finn"),
    ]
    for voter, target in votes:
        await db.mvp_votes.insert_one(
            {
                "id": new_id(),
                "match_id": match_id,
                "voter_id": player_ids[voter],
                "voter_phone": next(p[1] for p in seed_players if p[0] == voter),
                "vote_for_player_id": player_ids[target],
                "created_at": now_iso(),
            }
        )
    logger.info(f"Seeded demo match {match_id}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
