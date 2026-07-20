"""Unit tests for the players router (history + rating-history + demo)."""
import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_history_zero_for_unknown_phone(client):
    r = client.get("/api/history/does_not_exist_xyz")
    assert r.status_code == 200
    d = r.json()
    assert d["matches_played"] == 0 and d["mvp_count"] == 0


def test_rating_history_shape_empty(client):
    r = client.get("/api/players/no_such_phone/rating-history")
    assert r.status_code == 200
    d = r.json()
    assert "history" in d and "current_rating" in d and "matches_played" in d


def test_rating_history_populated_after_played(client):
    m = client.post("/api/matches", json={
        "date_time": "2026-03-01T20:00:00Z", "location": "P",
        "total_cost": 40, "max_players": 4, "num_teams": 2,
    }).json()
    for i in range(4):
        client.post(f"/api/matches/{m['id']}/join", json={
            "name": f"R{i}", "phone": f"rh{i}", "position": "Midfielder", "rating": 3,
        })
    client.post(f"/api/matches/{m['id']}/admin/{m['admin_token']}/generate-teams")
    client.post(f"/api/matches/{m['id']}/admin/{m['admin_token']}/mark-played", json={"winning_team": 1})
    r = client.get("/api/players/rh0/rating-history").json()
    assert r["current_rating"] is not None
    assert len(r["history"]) >= 1


def test_demo_endpoint(client):
    r = client.get("/api/demo")
    assert r.status_code == 200
    assert "match_id" in r.json()
