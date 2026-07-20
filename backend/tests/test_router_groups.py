"""Unit tests for the groups router."""
import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_group_create_returns_token(client):
    r = client.post("/api/groups", json={"name": "Unit FC"})
    assert r.status_code == 200
    g = r.json()
    assert "id" in g and len(g["admin_token"]) >= 30 and g["name"] == "Unit FC"


def test_group_dashboard_403_on_wrong_token(client):
    g = client.post("/api/groups", json={"name": "Sec FC"}).json()
    r = client.get(f"/api/groups/{g['id']}/admin/nope")
    assert r.status_code == 403


def test_group_dashboard_empty_shape(client):
    g = client.post("/api/groups", json={"name": "Empty FC"}).json()
    r = client.get(f"/api/groups/{g['id']}/admin/{g['admin_token']}")
    assert r.status_code == 200
    d = r.json()
    for key in ("group", "matches", "standings", "mvp_leaderboard", "top_gainers"):
        assert key in d
    assert d["matches"] == []


def test_group_scoped_match_carries_group_id(client):
    g = client.post("/api/groups", json={"name": "Link FC"}).json()
    r = client.post(f"/api/groups/{g['id']}/admin/{g['admin_token']}/matches", json={
        "date_time": "2026-03-01T20:00:00Z",
        "location": "P", "total_cost": 40, "max_players": 6, "num_teams": 2,
    })
    assert r.status_code == 200
    m = r.json()
    assert m["group_id"] == g["id"]
    fetched = client.get(f"/api/matches/{m['id']}/admin/{m['admin_token']}").json()
    assert fetched["match"].get("group_id") == g["id"]
