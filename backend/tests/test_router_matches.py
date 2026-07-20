"""Unit tests for the matches router (post v1.2 split).

Uses FastAPI's TestClient hitting the mounted app. These tests target the
matches router endpoints in isolation and MUST pass regardless of router
extraction — they protect against future edits accidentally changing shapes.
"""
import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _create_match(client, **overrides):
    body = {
        "date_time": "2026-03-01T20:00:00Z",
        "location": "Test Pitch",
        "total_cost": 40.0,
        "max_players": 8,
        "num_teams": 2,
        **overrides,
    }
    r = client.post("/api/matches", json=body)
    assert r.status_code == 200
    return r.json()


def test_matches_router_root(client):
    r = client.get("/api/")
    assert r.status_code == 200
    assert r.json() == {"message": "FairXI API"}


def test_matches_create_returns_admin_token(client):
    m = _create_match(client)
    assert "id" in m and "admin_token" in m
    assert len(m["admin_token"]) >= 30  # 192-bit token


def test_matches_public_hides_admin_token_and_phone(client):
    m = _create_match(client)
    client.post(f"/api/matches/{m['id']}/join", json={
        "name": "Neo", "phone": "px1", "position": "Midfielder", "rating": 3
    })
    pub = client.get(f"/api/matches/{m['id']}").json()
    assert "admin_token" not in pub["match"]
    assert all("phone" not in p and "paid" not in p for p in pub["players"])


def test_matches_admin_view_shows_full_players(client):
    m = _create_match(client)
    client.post(f"/api/matches/{m['id']}/join", json={
        "name": "Trin", "phone": "px2", "position": "Forward", "rating": 4
    })
    r = client.get(f"/api/matches/{m['id']}/admin/{m['admin_token']}")
    assert r.status_code == 200
    p = r.json()["players"][0]
    assert p["phone"] == "px2" and p["paid"] is False


def test_matches_generate_teams_requires_min_4(client):
    m = _create_match(client)
    r = client.post(f"/api/matches/{m['id']}/admin/{m['admin_token']}/generate-teams")
    assert r.status_code == 400


def test_matches_bulk_add_and_generate(client):
    m = _create_match(client)
    payload = {"players": [
        {"name": f"P{i}", "phone": f"bulkp{i}", "position": "Midfielder", "rating": 3}
        for i in range(4)
    ]}
    r = client.post(f"/api/matches/{m['id']}/admin/{m['admin_token']}/bulk-add", json=payload)
    assert r.json()["added"] == 4
    r = client.post(f"/api/matches/{m['id']}/admin/{m['admin_token']}/generate-teams")
    assert r.status_code == 200


def test_matches_mark_played_is_idempotent(client):
    m = _create_match(client)
    client.post(f"/api/matches/{m['id']}/admin/{m['admin_token']}/bulk-add", json={"players": [
        {"name": f"IP{i}", "phone": f"idempp{i}", "position": "Midfielder", "rating": 3}
        for i in range(4)
    ]})
    client.post(f"/api/matches/{m['id']}/admin/{m['admin_token']}/generate-teams")
    r1 = client.post(f"/api/matches/{m['id']}/admin/{m['admin_token']}/mark-played", json={"winning_team": 1}).json()
    r2 = client.post(f"/api/matches/{m['id']}/admin/{m['admin_token']}/mark-played", json={"winning_team": 1}).json()
    assert r1["recomputed"] is True
    assert r2["recomputed"] is False


def test_matches_wrong_admin_token_403(client):
    m = _create_match(client)
    r = client.get(f"/api/matches/{m['id']}/admin/wrong")
    assert r.status_code == 403
