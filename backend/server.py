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
    name: Optional[str] = None
    date_time: str
    location: str
    total_cost: float
    max_players: int
    num_teams: int = 2


class PlayerJoin(BaseModel):
    name: str
    phone: str
    position: Position
    rating: int = Field(ge=1, le=5)


class TeamReassign(BaseModel):
    team_number: int


class PaymentUpdate(BaseModel):
    paid: bool


class MVPVoteIn(BaseModel):
    voter_phone: str
    vote_for_player_id: str


# ---------- HELPERS ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def token() -> str:
    return secrets.token_urlsafe(12)


def scrub(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def snake_draft(players: List[dict], num_teams: int) -> List[dict]:
    """Sort players by rating desc, then snake-draft across N teams.
    Secondary: light position variety without breaking sort order."""
    sorted_players = sorted(players, key=lambda p: (-p["rating"], p["name"]))
    assignments: List[List[dict]] = [[] for _ in range(num_teams)]

    # First pass: pure snake draft by rating
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

    # Position variety secondary pass: within each snake "row" of N players,
    # if two players have identical rating and swapping improves position diversity, swap.
    result_players = []
    for i, p in enumerate(sorted_players):
        team = order[i]
        result_players.append({**p, "team_number": team + 1})

    # Attempt light rebalance: for consecutive pairs with same rating, swap if it
    # reduces position stacking on receiving team.
    def team_positions(team_idx):
        return [rp["position"] for rp in result_players if rp["team_number"] == team_idx + 1]

    for i in range(len(result_players) - 1):
        a = result_players[i]
        b = result_players[i + 1]
        if a["rating"] == b["rating"] and a["team_number"] != b["team_number"]:
            ta = team_positions(a["team_number"] - 1)
            tb = team_positions(b["team_number"] - 1)
            stack_now = ta.count(a["position"]) + tb.count(b["position"])
            # simulate swap
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
    # public player view: hide payment status
    public_players = [
        {k: v for k, v in p.items() if k not in ("paid",)} for p in players
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


@api_router.post("/matches/{match_id}/admin/{admin_token}/generate-teams")
async def generate_teams(match_id: str, admin_token: str):
    match = await get_match_or_404(match_id)
    if match["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    players = await get_players(match_id)
    if len(players) < 4:
        raise HTTPException(400, "Need at least 4 players to generate teams")

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


@api_router.post("/matches/{match_id}/admin/{admin_token}/mark-played")
async def mark_played(match_id: str, admin_token: str):
    match = await get_match_or_404(match_id)
    if match["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")
    await db.matches.update_one({"id": match_id}, {"$set": {"status": "played"}})
    return {"ok": True}


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


@api_router.post("/matches/{match_id}/mvp/vote")
async def cast_mvp_vote(match_id: str, body: MVPVoteIn):
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
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
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
