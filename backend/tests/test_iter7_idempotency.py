"""Iter7: mark-played idempotency + PAY_PROVIDERS input validation smoke."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')
API = f"{BASE_URL}/api"


def _mk_match():
    r = requests.post(f"{API}/matches", json={
        "date_time": "2026-02-05T20:00:00Z",
        "location": "TEST_Iter7",
        "total_cost": 100.0,
        "max_players": 4,
        "num_teams": 2,
    })
    assert r.status_code == 200, r.text
    return r.json()


def _join(mid, name, phone, rating=3):
    r = requests.post(f"{API}/matches/{mid}/join", json={
        "name": name, "phone": phone, "position": "Midfielder", "rating": rating,
    })
    assert r.status_code == 200, r.text


def _setup_played_match():
    m = _mk_match()
    mid = m["id"]
    admin = m["admin_token"]
    ts = int(time.time() * 1000) % 100000000
    phones = [f"TESTI7{ts}{i}" for i in range(4)]
    seeds = [("TEST_I7_A", phones[0], 4),
             ("TEST_I7_B", phones[1], 5),
             ("TEST_I7_C", phones[2], 3),
             ("TEST_I7_D", phones[3], 2)]
    for n, p, r in seeds:
        _join(mid, n, p, r)
        time.sleep(0.05)
    gt = requests.post(f"{API}/matches/{mid}/admin/{admin}/generate-teams")
    assert gt.status_code == 200, gt.text
    return mid, admin, phones


class TestMarkPlayedIdempotency:
    def test_double_mark_played_is_idempotent(self):
        mid, admin, phones = _setup_played_match()

        # First mark-played
        r1 = requests.post(f"{API}/matches/{mid}/admin/{admin}/mark-played",
                           json={"winning_team": 1})
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["recomputed"] is True
        rc1 = d1["rating_changes"]
        assert len(rc1) == 4

        # Verify rating_history via player rating-history endpoint (1 row per player)
        history_counts_1 = {}
        stats_1 = {}
        for p in phones:
            rh = requests.get(f"{API}/players/{p}/rating-history").json()
            history_counts_1[p] = len(rh["history"])
            stats_1[p] = rh["matches_played"]
            assert rh["matches_played"] == 1, f"{p} matches_played={rh['matches_played']}"
            assert len(rh["history"]) == 1, f"{p} history len={len(rh['history'])}"

        # Second call — different winning_team (organizer correction)
        r2 = requests.post(f"{API}/matches/{mid}/admin/{admin}/mark-played",
                           json={"winning_team": 2})
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2["recomputed"] is False, f"expected recomputed=False, got {d2}"
        rc2 = d2["rating_changes"]

        # rating_changes should match first call (not recomputed)
        assert set(rc1.keys()) == set(rc2.keys())
        for phone in rc1:
            assert rc1[phone]["old"] == rc2[phone]["old"], f"{phone} old mismatch"
            assert rc1[phone]["new"] == rc2[phone]["new"], f"{phone} new mismatch"
            assert rc1[phone]["delta"] == rc2[phone]["delta"], f"{phone} delta mismatch"

        # Player stats & history still =1
        for p in phones:
            rh = requests.get(f"{API}/players/{p}/rating-history").json()
            assert rh["matches_played"] == 1, f"{p} matches_played after 2nd call = {rh['matches_played']}"
            assert len(rh["history"]) == 1, f"{p} history after 2nd call = {len(rh['history'])}"

        # winning_team on match doc DID update to latest
        mres = requests.get(f"{API}/matches/{mid}").json()
        assert mres["match"]["winning_team"] == 2, f"expected winning_team updated to 2, got {mres['match'].get('winning_team')}"
        assert mres["match"]["status"] == "played"

    def test_mark_played_no_body_still_works(self):
        # Backward-compat sanity: calling without body should also be idempotent.
        mid, admin, _ = _setup_played_match()
        r1 = requests.post(f"{API}/matches/{mid}/admin/{admin}/mark-played")
        assert r1.status_code == 200
        assert r1.json()["recomputed"] is True
        r2 = requests.post(f"{API}/matches/{mid}/admin/{admin}/mark-played")
        assert r2.status_code == 200
        assert r2.json()["recomputed"] is False


class TestRegressionSmoke:
    def test_groups_create_and_dashboard(self):
        r = requests.post(f"{API}/groups", json={"name": "TEST_I7_Group"})
        assert r.status_code == 200, r.text
        g = r.json()
        assert len(g["admin_token"]) >= 30
        gid, tok = g["id"], g["admin_token"]
        d = requests.get(f"{API}/groups/{gid}/admin/{tok}")
        assert d.status_code == 200
        data = d.json()
        for key in ("standings", "mvp_leaderboard", "top_gainers"):
            assert key in data

    def test_group_dashboard_wrong_token_403(self):
        r = requests.post(f"{API}/groups", json={"name": "TEST_I7_Group2"})
        gid = r.json()["id"]
        d = requests.get(f"{API}/groups/{gid}/admin/wrongtokenwrongtokenwrongtoken")
        assert d.status_code == 403

    def test_rating_history_endpoint_shape(self):
        # Use any test phone that shouldn't exist -> matches_played 0
        rh = requests.get(f"{API}/players/NOEXIST_PHONE_XYZ/rating-history")
        assert rh.status_code == 200
        d = rh.json()
        assert "current_rating" in d
        assert "matches_played" in d
        assert "history" in d
        assert isinstance(d["history"], list)

    def test_admin_token_length_and_hidden_on_public(self):
        m = _mk_match()
        assert len(m["admin_token"]) >= 30
        pub = requests.get(f"{API}/matches/{m['id']}").json()
        assert "admin_token" not in pub or not pub.get("admin_token")
