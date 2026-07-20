"""Shared dependencies for all FairXI routers.

Owns the singleton Mongo client + db, shared Pydantic models, helpers
(get_match_or_404, snake_draft, rate_limit, etc.) and the API router prefix.
Every router imports from here — server.py only wires them up.
"""
from fastapi import APIRouter, HTTPException
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone
import os
import secrets
import uuid


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

_mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(_mongo_url)
db = client[os.environ["DB_NAME"]]

# All routers share the same /api prefix. server.py mounts this once.
api_router = APIRouter(prefix="/api")


# ---------- TYPES ----------
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
    winning_team: Optional[int] = Field(default=None, ge=1, le=8)


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
    # 24 bytes → 32 url-safe chars, ~192 bits of entropy
    return secrets.token_urlsafe(24)


def scrub(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def player_share(match: dict, num_players: int) -> float:
    if num_players <= 0:
        return 0.0
    return round(match["total_cost"] / num_players, 2)


# ---------- Rate limiter (per-process, single-worker) ----------
_RATE_BUCKETS: dict = {}


def rate_limit(key: str, max_hits: int, window_seconds: int) -> None:
    now = datetime.now(timezone.utc).timestamp()
    hits = [t for t in _RATE_BUCKETS.get(key, []) if now - t < window_seconds]
    if len(hits) >= max_hits:
        raise HTTPException(429, "Too many requests, please slow down")
    hits.append(now)
    _RATE_BUCKETS[key] = hits


# ---------- Match/team helpers ----------
async def get_match_or_404(match_id: str) -> dict:
    m = await db.matches.find_one({"id": match_id})
    if not m:
        raise HTTPException(404, "Match not found")
    return scrub(m)


async def get_group_or_404(group_id: str) -> dict:
    g = await db.groups.find_one({"id": group_id})
    if not g:
        raise HTTPException(404, "Group not found")
    return scrub(g)


async def get_players(match_id: str) -> List[dict]:
    cursor = db.players.find({"match_id": match_id}, {"_id": 0})
    return await cursor.to_list(500)


def snake_draft(players: List[dict], num_teams: int) -> List[dict]:
    """Sort players by effective rating desc, then snake-draft across N teams.
    Secondary: light position variety without breaking sort order.
    Uses `effective_rating` if present (dynamic rating), else falls back to `rating`.
    """
    def eff(p):
        return float(p.get("effective_rating", p.get("rating", 3)))

    sorted_players = sorted(players, key=lambda p: (-eff(p), p["name"]))

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


def is_voting_closed(match: dict) -> bool:
    from datetime import timedelta
    if match["status"] == "completed":
        return True
    if match["status"] != "mvp_voting_open":
        return True
    opened = match.get("mvp_opened_at")
    if not opened:
        return True
    opened_dt = datetime.fromisoformat(opened)
    return datetime.now(timezone.utc) - opened_dt > timedelta(hours=24)
