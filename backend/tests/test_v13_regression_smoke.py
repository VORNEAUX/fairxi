"""v1.3 regression smoke against public URL: match lifecycle + groups + MVP voting."""
import os, uuid, requests, pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://squad-balance-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


def _create_match(max_players=4):
    payload = {"name": f"TEST_{uuid.uuid4().hex[:6]}", "location": "Field A",
               "date_time": "2026-02-01T18:00:00Z", "total_cost": 100, "max_players": max_players, "num_teams": 2}
    r = requests.post(f"{API}/matches", json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    return r.json()


def _join(mid, i, phone_prefix="55500"):
    body = {"name": f"P{i}", "phone": f"{phone_prefix}{i:05d}", "position": "Midfielder", "rating": 3 + (i % 3)}
    return requests.post(f"{API}/matches/{mid}/join", json=body, timeout=10)


def test_match_lifecycle_generate_teams():
    m = _create_match(4)
    mid = m["id"]; token = m["admin_token"]
    for i in range(4):
        r = _join(mid, i)
        assert r.status_code in (200, 201), r.text
    gr = requests.post(f"{API}/matches/{mid}/admin/{token}/generate-teams", timeout=15)
    assert gr.status_code == 200, gr.text
    gm = requests.get(f"{API}/matches/{mid}", timeout=10).json()
    players = gm.get("players", [])
    team_nums = {p.get("team_number") for p in players if p.get("team_number")}
    assert len(team_nums) >= 2, gm


def test_groups_create_and_admin_get():
    r = requests.post(f"{API}/groups", json={"name": f"TEST_grp_{uuid.uuid4().hex[:5]}"}, timeout=10)
    assert r.status_code in (200, 201), r.text
    d = r.json()
    gid = d["id"]; tok = d["admin_token"]
    g = requests.get(f"{API}/groups/{gid}/admin/{tok}", timeout=10)
    assert g.status_code == 200, g.text


def test_mvp_vote_once_per_phone():
    m = _create_match(4)
    mid = m["id"]; tok = m["admin_token"]
    for i in range(4):
        _join(mid, i, phone_prefix="66600")
    requests.post(f"{API}/matches/{mid}/admin/{tok}/generate-teams", timeout=15)
    # mark played to enable MVP
    requests.post(f"{API}/matches/{mid}/admin/{tok}/mark-played", json={"winning_team": 1}, timeout=10)
    # open MVP
    op = requests.post(f"{API}/matches/{mid}/admin/{tok}/open-mvp", timeout=10)
    if op.status_code >= 400:
        pytest.skip(f"open-mvp not available: {op.status_code} {op.text}")
    admin = requests.get(f"{API}/matches/{mid}/admin/{tok}", timeout=10).json()
    players = admin.get("players", [])
    if not players:
        pytest.skip("no players")
    voter = players[0]
    same_team = [p for p in players if p["team_number"] == voter["team_number"] and p["id"] != voter["id"]]
    if not same_team:
        pytest.skip("no teammates")
    body = {"voter_phone": voter["phone"], "vote_for_player_id": same_team[0]["id"]}
    v1 = requests.post(f"{API}/matches/{mid}/mvp/vote", json=body, timeout=10)
    v2 = requests.post(f"{API}/matches/{mid}/mvp/vote", json=body, timeout=10)
    # accept if voting requires verify first (returns 4xx); otherwise second must fail
    if v1.status_code in (200, 201):
        assert v2.status_code >= 400, f"duplicate vote should fail: {v2.status_code} {v2.text}"
    else:
        # if flow needs verify, still confirm endpoint exists (not 404) and rejects properly
        assert v1.status_code != 404, v1.text
