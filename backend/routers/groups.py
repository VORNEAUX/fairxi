"""Group endpoints — persistent group of matches for a regular crew."""
from datetime import datetime
from fastapi import HTTPException

from deps import (
    api_router,
    db,
    GroupCreate,
    GroupMatchCreate,
    new_id,
    now_iso,
    token,
    rate_limit,
    get_group_or_404,
)


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


@api_router.get("/groups/{group_id}/admin/{admin_token}")
async def get_group_dashboard(group_id: str, admin_token: str):
    g = await get_group_or_404(group_id)
    if g["admin_token"] != admin_token:
        raise HTTPException(403, "Invalid admin token")

    matches = (
        await db.matches.find({"group_id": group_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )
    match_ids = [m["id"] for m in matches]
    players_across = (
        await db.players.find({"match_id": {"$in": match_ids}}, {"_id": 0}).to_list(5000)
    )
    votes_across = (
        await db.mvp_votes.find({"match_id": {"$in": match_ids}}, {"_id": 0}).to_list(5000)
    )

    by_phone: dict = {}
    for p in players_across:
        by_phone.setdefault(
            p["phone"],
            {
                "phone": p["phone"],
                "name": p["name"],
                "matches": 0,
                "wins": 0,
                "draws": 0,
                "losses": 0,
                "mvp_count": 0,
            },
        )

    match_by_id = {m["id"]: m for m in matches}
    for p in players_across:
        m = match_by_id.get(p["match_id"])
        if not m or m.get("status") not in ("played", "completed", "mvp_voting_open"):
            continue
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
