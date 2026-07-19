import os
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
# Fallback: read from frontend/.env
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"


def _create_match(max_players=6, num_teams=2):
    dt = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    r = requests.post(
        f"{API}/matches",
        json={
            "name": "TEST_bulk",
            "date_time": dt,
            "location": "TEST_loc",
            "total_cost": 60.0,
            "max_players": max_players,
            "num_teams": num_teams,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


def _players(n, start=100):
    return [
        {
            "name": f"TEST_P{i}",
            "phone": f"5559{start+i:06d}",
            "position": ["Goalkeeper", "Defender", "Midfielder", "Forward"][i % 4],
            "rating": (i % 5) + 1,
        }
        for i in range(n)
    ]


# ---------- Bulk-add new endpoint ----------

def test_bulk_add_happy_path():
    m = _create_match(max_players=6)
    r = requests.post(
        f"{API}/matches/{m['id']}/admin/{m['admin_token']}/bulk-add",
        json={"players": _players(4)},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["added"] == 4
    assert data["skipped"] == 0
    # verify persistence
    g = requests.get(f"{API}/matches/{m['id']}").json()
    assert len(g["players"]) == 4


def test_bulk_add_dupes_skipped():
    m = _create_match(max_players=6)
    payload = _players(3, start=200)
    r1 = requests.post(
        f"{API}/matches/{m['id']}/admin/{m['admin_token']}/bulk-add",
        json={"players": payload},
    )
    assert r1.json()["added"] == 3
    # send same again + one new
    payload2 = payload + _players(1, start=300)
    r2 = requests.post(
        f"{API}/matches/{m['id']}/admin/{m['admin_token']}/bulk-add",
        json={"players": payload2},
    )
    d = r2.json()
    assert d["added"] == 1
    assert d["skipped"] == 3
    g = requests.get(f"{API}/matches/{m['id']}").json()
    assert len(g["players"]) == 4


def test_bulk_add_respects_max_players():
    m = _create_match(max_players=3)
    r = requests.post(
        f"{API}/matches/{m['id']}/admin/{m['admin_token']}/bulk-add",
        json={"players": _players(6, start=400)},
    )
    d = r.json()
    assert d["added"] == 3
    assert d["skipped"] == 3


def test_bulk_add_bad_token():
    m = _create_match()
    r = requests.post(
        f"{API}/matches/{m['id']}/admin/wrong-token/bulk-add",
        json={"players": _players(2, start=500)},
    )
    assert r.status_code == 403


def test_bulk_add_invalid_rating_422():
    m = _create_match()
    r = requests.post(
        f"{API}/matches/{m['id']}/admin/{m['admin_token']}/bulk-add",
        json={"players": [{"name": "X", "phone": "9", "position": "Forward", "rating": 9}]},
    )
    assert r.status_code == 422


# ---------- Regression ----------

def test_demo_still_intact():
    r = requests.get(f"{API}/demo")
    assert r.status_code == 200
    mid = r.json()["match_id"]
    res = requests.get(f"{API}/matches/{mid}/mvp/results").json()
    assert res["mvp"] is not None
    assert res["mvp"]["name"] == "Ben"


def test_end_to_end_flow():
    m = _create_match(max_players=6, num_teams=2)
    # join via bulk-add
    requests.post(
        f"{API}/matches/{m['id']}/admin/{m['admin_token']}/bulk-add",
        json={"players": _players(6, start=600)},
    )
    # generate teams
    r = requests.post(f"{API}/matches/{m['id']}/admin/{m['admin_token']}/generate-teams")
    assert r.status_code == 200
    # payment toggle
    g = requests.get(f"{API}/matches/{m['id']}/admin/{m['admin_token']}").json()
    p0 = g["players"][0]
    r = requests.patch(
        f"{API}/matches/{m['id']}/admin/{m['admin_token']}/players/{p0['id']}/payment",
        json={"paid": True},
    )
    assert r.status_code == 200
    # mark played + open mvp
    r = requests.post(f"{API}/matches/{m['id']}/admin/{m['admin_token']}/mark-played")
    assert r.status_code == 200
    r = requests.post(f"{API}/matches/{m['id']}/admin/{m['admin_token']}/open-mvp")
    assert r.status_code == 200
    # vote (teammate)
    g = requests.get(f"{API}/matches/{m['id']}/admin/{m['admin_token']}").json()
    ps = g["players"]
    voter = ps[0]
    teammate = next(p for p in ps[1:] if p["team_number"] == voter["team_number"])
    r = requests.post(
        f"{API}/matches/{m['id']}/mvp/vote",
        json={"voter_phone": voter["phone"], "vote_for_player_id": teammate["id"]},
    )
    assert r.status_code == 200, r.text
    # history
    r = requests.get(f"{API}/history/{voter['phone']}")
    assert r.status_code == 200
    assert r.json()["matches_played"] >= 1


def test_join_duplicate_phone_rejected():
    m = _create_match()
    p = {"name": "TEST_dup", "phone": "5559999999", "position": "Forward", "rating": 3}
    r1 = requests.post(f"{API}/matches/{m['id']}/join", json=p)
    assert r1.status_code == 200
    r2 = requests.post(f"{API}/matches/{m['id']}/join", json=p)
    assert r2.status_code == 400
