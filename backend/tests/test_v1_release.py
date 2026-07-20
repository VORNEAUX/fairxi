"""FairXI v1 release backend tests: rating PATCH, admin_token length, rate limit, regression."""
import os
import requests
import pytest
from datetime import datetime, timezone, timedelta

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback: read frontend .env directly (for pytest env)
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE}/api"


def _create_match(name="TEST_match", max_players=10, num_teams=2):
    dt = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    r = requests.post(f"{API}/matches", json={
        "name": name,
        "date_time": dt,
        "location": "TEST_pitch",
        "total_cost": 100.0,
        "max_players": max_players,
        "num_teams": num_teams,
    })
    assert r.status_code == 200, r.text
    return r.json()


def _join(mid, name, phone, pos="Midfielder", rating=3):
    return requests.post(f"{API}/matches/{mid}/join", json={
        "name": name, "phone": phone, "position": pos, "rating": rating
    })


class TestAdminTokenLength:
    def test_token_length_ge_30(self):
        d = _create_match(name="TEST_token")
        # secrets.token_urlsafe(24) => 32 chars
        assert len(d["admin_token"]) >= 30, f"got length {len(d['admin_token'])}"


class TestRatingPatch:
    def setup_method(self):
        d = _create_match(name="TEST_rating")
        self.mid = d["id"]
        self.token = d["admin_token"]
        r = _join(self.mid, "TEST_p1", "9990001111", rating=3)
        assert r.status_code == 200
        self.pid = r.json()["id"]

    def test_valid_rating_update(self):
        r = requests.patch(f"{API}/matches/{self.mid}/admin/{self.token}/players/{self.pid}/rating",
                           json={"rating": 5})
        assert r.status_code == 200
        # verify via admin GET
        g = requests.get(f"{API}/matches/{self.mid}/admin/{self.token}")
        assert g.status_code == 200
        players = g.json()["players"]
        p = next(p for p in players if p["id"] == self.pid)
        assert p["rating"] == 5

    def test_rating_zero_422(self):
        r = requests.patch(f"{API}/matches/{self.mid}/admin/{self.token}/players/{self.pid}/rating",
                           json={"rating": 0})
        assert r.status_code == 422

    def test_rating_six_422(self):
        r = requests.patch(f"{API}/matches/{self.mid}/admin/{self.token}/players/{self.pid}/rating",
                           json={"rating": 6})
        assert r.status_code == 422

    def test_wrong_admin_token_403(self):
        r = requests.patch(f"{API}/matches/{self.mid}/admin/BADTOKEN/players/{self.pid}/rating",
                           json={"rating": 4})
        assert r.status_code == 403


class TestRateLimit:
    def test_join_rate_limit(self):
        d = _create_match(name="TEST_ratelimit", max_players=64)
        mid = d["id"]
        # burst >30 joins to same match — should hit rate_limit (max 30 in 60s)
        got_429 = False
        for i in range(45):
            r = _join(mid, f"n{i}", f"800000{i:04d}", rating=3)
            if r.status_code == 429:
                got_429 = True
                break
        assert got_429, "Expected 429 within 45 join attempts"


class TestFullRegression:
    """Runs the full match lifecycle to catch regressions from lazy loading + P0 changes."""

    def test_lifecycle(self):
        d = _create_match(name="TEST_full", max_players=6, num_teams=2)
        mid, tok = d["id"], d["admin_token"]

        # bulk-add 4 players
        r = requests.post(f"{API}/matches/{mid}/admin/{tok}/bulk-add", json={
            "players": [
                {"name": "A", "phone": "7000000001", "position": "Goalkeeper", "rating": 4},
                {"name": "B", "phone": "7000000002", "position": "Defender", "rating": 5},
                {"name": "C", "phone": "7000000003", "position": "Midfielder", "rating": 3},
                {"name": "D", "phone": "7000000004", "position": "Forward", "rating": 4},
            ]
        })
        assert r.status_code == 200, r.text
        assert r.json()["added"] == 4

        # public GET
        pub = requests.get(f"{API}/matches/{mid}")
        assert pub.status_code == 200
        assert "admin_token" not in pub.json()["match"]
        for p in pub.json()["players"]:
            assert "phone" not in p  # PII stripped

        # admin GET
        adm = requests.get(f"{API}/matches/{mid}/admin/{tok}")
        assert adm.status_code == 200
        players = adm.json()["players"]
        assert len(players) == 4

        # generate teams
        r = requests.post(f"{API}/matches/{mid}/admin/{tok}/generate-teams")
        assert r.status_code == 200

        # reassign team
        pid = players[0]["id"]
        r = requests.patch(f"{API}/matches/{mid}/admin/{tok}/players/{pid}/team",
                           json={"team_number": 2})
        assert r.status_code == 200

        # payment
        r = requests.patch(f"{API}/matches/{mid}/admin/{tok}/players/{pid}/payment",
                           json={"paid": True})
        assert r.status_code == 200

        # mark played
        r = requests.post(f"{API}/matches/{mid}/admin/{tok}/mark-played")
        assert r.status_code == 200

        # open mvp
        r = requests.post(f"{API}/matches/{mid}/admin/{tok}/open-mvp")
        assert r.status_code == 200

        # verify voter
        r = requests.post(f"{API}/matches/{mid}/mvp/verify", json={"phone": "7000000001"})
        assert r.status_code == 200

        # cast a vote (same team required)
        adm2 = requests.get(f"{API}/matches/{mid}/admin/{tok}").json()
        by_team = {}
        for p in adm2["players"]:
            by_team.setdefault(p["team_number"], []).append(p)
        team = next(t for t, pl in by_team.items() if len(pl) >= 2)
        voter = by_team[team][0]
        target = by_team[team][1]
        r = requests.post(f"{API}/matches/{mid}/mvp/vote", json={
            "voter_phone": voter["phone"], "vote_for_player_id": target["id"]
        })
        assert r.status_code == 200, r.text

        # results
        r = requests.get(f"{API}/matches/{mid}/mvp/results")
        assert r.status_code == 200

        # history
        r = requests.get(f"{API}/history/7000000001")
        assert r.status_code == 200
        assert r.json()["matches_played"] >= 1

        # remove player
        r = requests.delete(f"{API}/matches/{mid}/admin/{tok}/players/{pid}")
        assert r.status_code == 200

        # demo
        r = requests.get(f"{API}/demo")
        assert r.status_code == 200
        assert "match_id" in r.json()


class TestHistoryEmpty:
    def test_history_empty_number(self):
        r = requests.get(f"{API}/history/0000000000")
        assert r.status_code == 200
        assert r.json()["matches_played"] == 0


class TestPWAAssets:
    def test_manifest_ok(self):
        r = requests.get(f"{BASE}/manifest.json")
        assert r.status_code == 200
        m = r.json()
        sizes = {i.get("sizes") for i in m.get("icons", [])}
        assert any("192" in (s or "") for s in sizes)
        assert any("512" in (s or "") for s in sizes)

    def test_service_worker_content(self):
        r = requests.get(f"{BASE}/service-worker.js")
        assert r.status_code == 200
        # Cache name gets bumped on each PWA-affecting release — assert the pattern,
        # not the exact version, so bumps don't require a test edit every time.
        assert "fairxi-v" in r.text
        assert "SKIP_WAITING" in r.text
