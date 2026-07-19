"""Iteration 3 security-fix tests: PII scrub, verify endpoint, source-zip, input caps, CORS."""
import os
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


def _demo_id():
    r = requests.get(f"{API}/demo")
    assert r.status_code == 200
    return r.json()["match_id"]


def _create_match(**overrides):
    payload = {
        "name": "TEST_sec",
        "date_time": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "location": "TEST_loc",
        "total_cost": 60.0,
        "max_players": 6,
        "num_teams": 2,
    }
    payload.update(overrides)
    return requests.post(f"{API}/matches", json=payload)


# ---------- SEC-001: PII scrub on public match GET ----------

def test_public_match_no_phone_or_paid():
    mid = _demo_id()
    r = requests.get(f"{API}/matches/{mid}")
    assert r.status_code == 200
    data = r.json()
    assert data["players"], "demo must have players"
    allowed = {"id", "name", "position", "team_number", "rating"}
    for p in data["players"]:
        assert "phone" not in p, f"phone leaked in public players: {p}"
        assert "paid" not in p, f"paid leaked in public players: {p}"
        extra = set(p.keys()) - allowed
        assert not extra, f"unexpected fields exposed: {extra}"


def test_admin_match_still_has_phone_and_paid():
    # create a fresh match + join to inspect admin GET
    c = _create_match().json()
    requests.post(
        f"{API}/matches/{c['id']}/admin/{c['admin_token']}/bulk-add",
        json={"players": [{"name": "TEST_A", "phone": "5557000001", "position": "Forward", "rating": 3}]},
    )
    r = requests.get(f"{API}/matches/{c['id']}/admin/{c['admin_token']}")
    assert r.status_code == 200
    ps = r.json()["players"]
    assert ps, "expected 1 player"
    assert "phone" in ps[0]
    assert "paid" in ps[0]
    assert ps[0]["phone"] == "5557000001"


# ---------- New endpoint: /mvp/verify ----------

def test_mvp_verify_valid_phone():
    mid = _demo_id()
    r = requests.post(f"{API}/matches/{mid}/mvp/verify", json={"phone": "5551000002"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == "Ben"
    assert data["team_number"] == 1
    assert data["position"] == "Defender"
    assert "id" in data
    # should NOT leak phone in response
    assert "phone" not in data


def test_mvp_verify_unknown_phone_404():
    mid = _demo_id()
    r = requests.post(f"{API}/matches/{mid}/mvp/verify", json={"phone": "0000000000"})
    assert r.status_code == 404


def test_mvp_verify_bad_match_404():
    r = requests.post(f"{API}/matches/does-not-exist/mvp/verify", json={"phone": "5551000002"})
    assert r.status_code == 404


# ---------- SEC-004: source zip removed ----------

def test_source_zip_not_binary():
    r = requests.get(f"{BASE_URL}/fairxi-source.zip")
    # SPA fallback is acceptable (HTML); a real .zip is not
    ctype = r.headers.get("content-type", "")
    assert "application/zip" not in ctype, f"zip still served: {ctype}"
    # ensure it's not a binary zip payload magic bytes
    assert not r.content.startswith(b"PK\x03\x04"), "still serving actual zip content"


# ---------- Input validation (Pydantic caps) ----------

def test_match_name_too_long_422():
    r = _create_match(name="x" * 81)
    assert r.status_code == 422


def test_match_empty_location_422():
    r = _create_match(location="")
    assert r.status_code == 422


def test_join_rating_6_is_422():
    c = _create_match().json()
    r = requests.post(
        f"{API}/matches/{c['id']}/join",
        json={"name": "X", "phone": "5557111111", "position": "Forward", "rating": 6},
    )
    assert r.status_code == 422


def test_join_name_too_long_422():
    c = _create_match().json()
    r = requests.post(
        f"{API}/matches/{c['id']}/join",
        json={"name": "y" * 61, "phone": "5557111222", "position": "Forward", "rating": 3},
    )
    assert r.status_code == 422


# ---------- CORS ----------

def test_cors_preflight_ok():
    r = requests.options(
        f"{API}/demo",
        headers={
            "Origin": "https://example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code in (200, 204), r.status_code
    # allow_credentials should NOT be true anymore
    assert r.headers.get("access-control-allow-credentials", "").lower() != "true"


def test_regular_get_works():
    r = requests.get(f"{API}/demo")
    assert r.status_code == 200


# ---------- PWA regression ----------

def test_manifest_still_ok():
    r = requests.get(f"{BASE_URL}/manifest.json")
    assert r.status_code == 200
    assert "FairXI" in r.text or "fairxi" in r.text.lower()
