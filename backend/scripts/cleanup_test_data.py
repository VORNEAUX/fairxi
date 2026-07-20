"""FairXI — production-safe database cleanup script.

USAGE
-----
python -m scripts.cleanup_test_data           # dry-run (default): prints counts, deletes nothing
python -m scripts.cleanup_test_data --apply   # actually delete
python -m scripts.cleanup_test_data --apply --keep-demo   # keep the seeded demo match & its players/votes

WHAT IT REMOVES
---------------
- ALL documents from: matches, players, mvp_votes, rating_history, player_stats, groups
  (i.e. everything user- and test-generated).
- Optionally preserves the `is_demo: true` match plus its players and mvp_votes when --keep-demo is set.

SAFETY
------
- Dry-run by default. You must pass --apply to actually mutate the DB.
- Prints the target `DB_NAME` before doing anything and requires you to confirm interactively (or pass --yes).
- Does NOT drop the database or the collections themselves — only the documents inside them.
- Reads MONGO_URL and DB_NAME from backend/.env, same as the app. Run this against production
  by pointing the same env vars at the production connection string.
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

USER_COLLECTIONS = [
    "matches",
    "players",
    "mvp_votes",
    "rating_history",
    "player_stats",
    "groups",
]


async def counts(db):
    out = {}
    for c in USER_COLLECTIONS:
        out[c] = await db[c].count_documents({})
    return out


async def demo_ids(db):
    """Return the set of match_ids and player_ids that belong to the demo match, if any."""
    demo_match = await db.matches.find_one({"is_demo": True}, {"id": 1})
    if not demo_match:
        return None
    mid = demo_match["id"]
    player_ids = [p["id"] async for p in db.players.find({"match_id": mid}, {"id": 1})]
    return {"match_id": mid, "player_ids": player_ids}


async def cleanup(apply: bool, keep_demo: bool, yes: bool):
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    print(f"Target DB: {db_name}")
    print(f"Mongo URL: {mongo_url.split('@')[-1]}")  # hide creds if any

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    before = await counts(db)
    print("\nDocument counts BEFORE:")
    for k, v in before.items():
        print(f"  {k}: {v}")

    if not apply:
        print("\nDry-run only — pass --apply to actually delete.")
        return

    if not yes:
        confirm = input(f"\nType the DB name ({db_name!r}) to confirm deletion: ").strip()
        if confirm != db_name:
            print("Confirmation failed — aborting.")
            return

    filters = {c: {} for c in USER_COLLECTIONS}
    if keep_demo:
        demo = await demo_ids(db)
        if demo:
            filters["matches"] = {"is_demo": {"$ne": True}}
            filters["players"] = {"match_id": {"$ne": demo["match_id"]}}
            filters["mvp_votes"] = {"match_id": {"$ne": demo["match_id"]}}
            # Keep any player_stats and rating_history rows touched only by the demo seed
            # (these are tied to demo phones which won't collide with real users).
            demo_phones = [p["phone"] async for p in db.players.find(
                {"match_id": demo["match_id"]}, {"phone": 1})]
            if demo_phones:
                filters["player_stats"] = {"phone": {"$nin": demo_phones}}
                filters["rating_history"] = {"phone": {"$nin": demo_phones}}
            print(f"Preserving demo match {demo['match_id']} and {len(demo['player_ids'])} of its players.")
        else:
            print("No demo match found — --keep-demo has no effect.")

    print("\nDeleting…")
    for c in USER_COLLECTIONS:
        res = await db[c].delete_many(filters[c])
        print(f"  {c}: removed {res.deleted_count}")

    after = await counts(db)
    print("\nDocument counts AFTER:")
    for k, v in after.items():
        print(f"  {k}: {v}")
    print("\nDone.")


def main():
    p = argparse.ArgumentParser(description="FairXI DB cleanup — dry-run by default.")
    p.add_argument("--apply", action="store_true", help="actually delete (default is dry-run)")
    p.add_argument("--keep-demo", action="store_true", help="preserve the is_demo:true match")
    p.add_argument("--yes", action="store_true", help="skip interactive confirmation (CI use only)")
    args = p.parse_args()
    if not os.environ.get("MONGO_URL") or not os.environ.get("DB_NAME"):
        print("ERROR: MONGO_URL and DB_NAME must be set (via backend/.env or the shell).", file=sys.stderr)
        sys.exit(2)
    asyncio.run(cleanup(apply=args.apply, keep_demo=args.keep_demo, yes=args.yes))


if __name__ == "__main__":
    main()
