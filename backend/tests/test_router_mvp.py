"""Unit tests for the MVP router."""
import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _seed_match(client, phones=("mvp_a", "mvp_b", "mvp_c", "mvp_d")):
    m = client.post("/api/matches", json={
        "date_time": "2026-03-01T20:00:00Z",
        "location": "P", "total_cost": 20, "max_players": 4, "num_teams": 2,
    }).json()
    for i, ph in enumerate(phones):
        client.post(f"/api/matches/{m['id']}/join", json={
            "name": f"Voter{i}", "phone": ph, "position": "Midfielder", "rating": 3
        })
    client.post(f"/api/matches/{m['id']}/admin/{m['admin_token']}/generate-teams")
    client.post(f"/api/matches/{m['id']}/admin/{m['admin_token']}/mark-played", json={"winning_team": 1})
    client.post(f"/api/matches/{m['id']}/admin/{m['admin_token']}/open-mvp")
    return m


def test_mvp_verify_returns_own_record_only(client):
    m = _seed_match(client)
    r = client.post(f"/api/matches/{m['id']}/mvp/verify", json={"phone": "mvp_a"})
    assert r.status_code == 200
    data = r.json()
    assert set(data.keys()) == {"id", "name", "team_number", "position"}


def test_mvp_verify_unknown_phone_404(client):
    m = _seed_match(client)
    r = client.post(f"/api/matches/{m['id']}/mvp/verify", json={"phone": "not_here"})
    assert r.status_code == 404


def test_mvp_vote_flow_and_results(client):
    m = _seed_match(client)
    # get teammates
    admin = client.get(f"/api/matches/{m['id']}/admin/{m['admin_token']}").json()
    a = next(p for p in admin["players"] if p["phone"] == "mvp_a")
    same_team = [p for p in admin["players"] if p["team_number"] == a["team_number"] and p["id"] != a["id"]]
    target = same_team[0]
    r = client.post(f"/api/matches/{m['id']}/mvp/vote", json={
        "voter_phone": "mvp_a", "vote_for_player_id": target["id"],
    })
    assert r.status_code == 200
    results = client.get(f"/api/matches/{m['id']}/mvp/results").json()
    assert any(row["votes"] > 0 for row in results["results"])


def test_mvp_cannot_vote_self(client):
    m = _seed_match(client)
    admin = client.get(f"/api/matches/{m['id']}/admin/{m['admin_token']}").json()
    a = next(p for p in admin["players"] if p["phone"] == "mvp_a")
    r = client.post(f"/api/matches/{m['id']}/mvp/vote", json={
        "voter_phone": "mvp_a", "vote_for_player_id": a["id"],
    })
    assert r.status_code == 400
