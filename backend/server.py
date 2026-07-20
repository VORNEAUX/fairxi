"""FairXI FastAPI app entry point.

Refactored in v1.2: business endpoints live in routers/*. This file only
wires the app together, mounts routers, configures CORS, and runs the
demo-seed startup task.
"""
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from datetime import datetime, timezone, timedelta
import os
import logging

from deps import client, db, api_router, new_id, now_iso, token

# Importing the router modules registers their routes on api_router.
from routers import matches, mvp, groups, players  # noqa: F401


app = FastAPI()
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def seed_demo():
    """Seed a single demo match on first startup.

    Gated by SEED_DEMO=true — production must leave this unset (or set to false)
    so the live database never receives synthetic data. Preview/dev sets it to
    true so the /demo route always has something to render.
    """
    if os.environ.get("SEED_DEMO", "false").lower() not in ("1", "true", "yes"):
        logger.info("SEED_DEMO is not enabled — skipping demo seed.")
        return
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

    votes = [
        ("Alex", "Ben"), ("Carlos", "Ben"), ("Dan", "Ben"), ("Ethan", "Ben"),
        ("Finn", "Gabe"), ("Hugo", "Gabe"), ("Ivan", "Gabe"), ("Jack", "Gabe"),
        ("Ben", "Carlos"), ("Gabe", "Finn"),
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
