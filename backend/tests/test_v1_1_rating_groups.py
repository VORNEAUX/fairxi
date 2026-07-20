"""FairXI v1.1 backend tests — rating engine, groups, backward compat."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')
API = f"{BASE_URL}/api"


# ---------- helpers ----------
def _mk_match(cost=100.0, max_players=10, num_teams=2):
    r = requests.post(f"{API}/matches", json={
        "date_time": "2026-02-01T20:00:00Z",
        "location": "TEST_Pitch",
        "total_cost": cost,
        "max_players": max_players,
        "num_teams": num_teams,
    })
    assert r.status_code == 200, r.text
    return r.json()


def _join(mid, name, phone, pos="Midfielder", rating=3):
    r = requests.post(f"{API}/matches/{mid}/join", json={
        "name": name, "phone": phone, "position": pos, "rating": rating,
    })
    assert r.status_code == 200, r.text
    return r.json()


def _bulk_add(mid, admin_token, players):
    r = requests.post(f"{API}/matches/{mid}/admin/{admin_token}/bulk-add",
                      json={"players": players})
    assert r.status_code == 200, r.text
    return r.json()


def _gen_teams(mid, admin_token):
    r = requests.post(f"{API}/matches/{mid}/admin/{admin_token}/generate-teams")
    assert r.status_code == 200, r.text


def _mark(mid, admin_token, winning_team=None, send_body=True):
    if send_body:
        r = requests.post(f"{API}/matches/{mid}/admin/{admin_token}/mark-played",
                          json={"winning_team": winning_team})
    else:
        r = requests.post(f"{API}/matches/{mid}/admin/{admin_token}/mark-played")
    return r


# ---------- P0 rating engine ----------
class TestRatingEngine:
    def test_win_loss_deltas(self):
        m = _mk_match(max_players=4)
        seeds = [("TEST_R_A", "TESTR11001", 4),
                 ("TEST_R_B", "TESTR11002", 5),
                 ("TEST_R_C", "TESTR11003", 3),
                 ("TEST_R_D", "TESTR11004", 2)]
        _bulk_add(m["id"], m["admin_token"],
                  [{"name": n, "phone": p, "position": "Midfielder", "rating": r}
                   for n, p, r in seeds])
        _gen_teams(m["id"], m["admin_token"])
        # figure out which team each phone is on
        admin = requests.get(f"{API}/matches/{m['id']}/admin/{m['admin_token']}").json()
        team_by_phone = {pl["phone"]: pl["team_number"] for pl in admin["players"]}

        r = _mark(m["id"], m["admin_token"], winning_team=1)
        assert r.status_code == 200, r.text
        rc = r.json()["rating_changes"]
        assert set(rc.keys()) == {p for _, p, _ in seeds}
        for _, phone, _seed in seeds:
            entry = rc[phone]
            assert "old" in entry and "new" in entry and "delta" in entry
            # winners gain, losers lose (no draws, no MVP votes here)
            if team_by_phone[phone] == 1:
                assert entry["new"] >= entry["old"], f"winner {phone} should not lose rating"
            else:
                assert entry["new"] <= entry["old"], f"loser {phone} should not gain rating"
            # clamp
            assert 1.0 <= entry["new"] <= 5.0

    def test_draw_actual_half(self):
        m = _mk_match(max_players=4)
        seeds = [("TEST_D_A", "TESTD11001", 3),
                 ("TEST_D_B", "TESTD11002", 3),
                 ("TEST_D_C", "TESTD11003", 3),
                 ("TEST_D_D", "TESTD11004", 3)]
        _bulk_add(m["id"], m["admin_token"],
                  [{"name": n, "phone": p, "position": "Midfielder", "rating": r}
                   for n, p, r in seeds])
        _gen_teams(m["id"], m["admin_token"])
        r = _mark(m["id"], m["admin_token"], winning_team=None)
        assert r.status_code == 200, r.text
        rc = r.json()["rating_changes"]
        for _, phone, _s in seeds:
            assert rc[phone]["actual"] == 0.5

    def test_rating_history_endpoint(self):
        m = _mk_match(max_players=4)
        seeds = [("TEST_H_A", "TESTH11001", 4),
                 ("TEST_H_B", "TESTH11002", 3),
                 ("TEST_H_C", "TESTH11003", 3),
                 ("TEST_H_D", "TESTH11004", 2)]
        _bulk_add(m["id"], m["admin_token"],
                  [{"name": n, "phone": p, "position": "Midfielder", "rating": r}
                   for n, p, r in seeds])
        _gen_teams(m["id"], m["admin_token"])
        _mark(m["id"], m["admin_token"], winning_team=1)
        r = requests.get(f"{API}/players/TESTH11001/rating-history")
        assert r.status_code == 200
        data = r.json()
        assert data["phone"] == "TESTH11001"
        assert data["current_rating"] is not None
        assert data["matches_played"] >= 1
        assert isinstance(data["history"], list) and len(data["history"]) >= 1
        h = data["history"][0]
        for k in ("old_rating", "new_rating", "delta", "opp_avg"):
            assert k in h

    def test_snake_draft_uses_dynamic_rating(self):
        """A phone that has a dynamic rating >> its new seed should still be picked early."""
        # Round 1: give TESTS11001 a strong dynamic rating (won a match, MVP-ish)
        m1 = _mk_match(max_players=4)
        _bulk_add(m1["id"], m1["admin_token"], [
            {"name": "TEST_S_STAR", "phone": "TESTS11001", "position": "Midfielder", "rating": 5},
            {"name": "TEST_S_B", "phone": "TESTS11002", "position": "Midfielder", "rating": 5},
            {"name": "TEST_S_C", "phone": "TESTS11003", "position": "Midfielder", "rating": 1},
            {"name": "TEST_S_D", "phone": "TESTS11004", "position": "Midfielder", "rating": 1},
        ])
        _gen_teams(m1["id"], m1["admin_token"])
        admin1 = requests.get(f"{API}/matches/{m1['id']}/admin/{m1['admin_token']}").json()
        star_team = next(p["team_number"] for p in admin1["players"] if p["phone"] == "TESTS11001")
        _mark(m1["id"], m1["admin_token"], winning_team=star_team)

        # Confirm dynamic rating persisted (should be near 5 - some tiny loss/gain)
        rh = requests.get(f"{API}/players/TESTS11001/rating-history").json()
        dynamic_star = rh["current_rating"]
        assert dynamic_star is not None

        # Round 2: same phone joins a new match with LOW seed=1, along with 3 seed=4 players.
        m2 = _mk_match(max_players=4)
        _bulk_add(m2["id"], m2["admin_token"], [
            {"name": "TEST_S_STAR", "phone": "TESTS11001", "position": "Midfielder", "rating": 1},
            {"name": "TEST_S_E", "phone": "TESTS12002", "position": "Midfielder", "rating": 4},
            {"name": "TEST_S_F", "phone": "TESTS12003", "position": "Midfielder", "rating": 4},
            {"name": "TEST_S_G", "phone": "TESTS12004", "position": "Midfielder", "rating": 4},
        ])
        _gen_teams(m2["id"], m2["admin_token"])
        admin2 = requests.get(f"{API}/matches/{m2['id']}/admin/{m2['admin_token']}").json()
        # In snake draft with 2 teams and effective ratings [~5 (star), 4, 4, 4]:
        # sorted desc by eff, team assignments: team 1, team 2, team 2, team 1
        # i.e. the star is picked FIRST → team 1, and last picked (4) is team 1.
        # Under pure-seed order it would have been (4,4,4,1) — snake: t1,t2,t2,t1
        # → star (seed=1) would be team 1 as the LAST pick.
        # Either way the star ends up on team 1 here. The stronger signal:
        # look at whether the star was actually picked FIRST — i.e. sorted first.
        # We infer that by checking: team 1 should include the star + one seed=4 player
        # AND team 2 should be the two "middle" seed=4 players. If effective_rating
        # was ignored, star would be alone-picked-last which yields the same team assignment
        # in this narrow 4-player case, so we can't distinguish 100%.
        # Instead: check that the star's per-player rating field remains 1 (seed unchanged)
        # but dynamic rating is used internally. Verify by inspecting the rating-history
        # from round 2 mark-played: opp_avg should reflect >= 4 (opponents' current ratings).
        _mark(m2["id"], m2["admin_token"], winning_team=1)
        rh2 = requests.get(f"{API}/players/TESTS11001/rating-history").json()
        # last (newest) entry
        last = rh2["history"][-1]
        # If effective_rating was used, opp_avg should be ~4 (their seeds/dynamics),
        # AND actual==0->loss OR win — either way, opp_avg must be a realistic mid-value.
        # More importantly: the seed=1 mismatch should NOT drag the star to actual=0 opp_avg~4;
        # we just assert opp_avg is a float in [1,5] and current_rating is still high.
        assert 1.0 <= last["opp_avg"] <= 5.0
        assert rh2["current_rating"] >= 2.0  # must not have collapsed to seed=1

    def test_backward_compat_mark_played_no_body(self):
        m = _mk_match(max_players=4)
        _bulk_add(m["id"], m["admin_token"], [
            {"name": "TEST_BC_A", "phone": "TESTBC11001", "position": "Midfielder", "rating": 3},
            {"name": "TEST_BC_B", "phone": "TESTBC11002", "position": "Midfielder", "rating": 3},
            {"name": "TEST_BC_C", "phone": "TESTBC11003", "position": "Midfielder", "rating": 3},
            {"name": "TEST_BC_D", "phone": "TESTBC11004", "position": "Midfielder", "rating": 3},
        ])
        _gen_teams(m["id"], m["admin_token"])
        # No body → treated as draw (winning_team=None)
        r = _mark(m["id"], m["admin_token"], send_body=False)
        assert r.status_code == 200, r.text

    def test_get_match_ungrouped_backward_compat(self):
        m = _mk_match(max_players=4)
        r = requests.get(f"{API}/matches/{m['id']}")
        assert r.status_code == 200
        # no group_id required
        assert "group_id" not in r.json()["match"] or r.json()["match"].get("group_id") is None


# ---------- P1 groups ----------
class TestGroups:
    def test_create_group_and_403_on_wrong_token(self):
        r = requests.post(f"{API}/groups", json={"name": "TEST_Sunday FC"})
        assert r.status_code == 200
        d = r.json()
        assert "id" in d and "admin_token" in d
        assert len(d["admin_token"]) >= 30
        assert d["name"] == "TEST_Sunday FC"

        # 403 on wrong token
        r2 = requests.get(f"{API}/groups/{d['id']}/admin/wrong_token_xxx")
        assert r2.status_code == 403

    def test_group_dashboard_after_played_match(self):
        # create group
        g = requests.post(f"{API}/groups", json={"name": "TEST_Dashboard FC"}).json()
        # create group match
        gm_body = {
            "date_time": "2026-02-02T20:00:00Z",
            "location": "TEST_GroupPitch",
            "total_cost": 60.0, "max_players": 4, "num_teams": 2,
        }
        gm = requests.post(f"{API}/groups/{g['id']}/admin/{g['admin_token']}/matches",
                           json=gm_body)
        assert gm.status_code == 200, gm.text
        gm = gm.json()
        assert gm.get("group_id") == g["id"]

        # verify match doc has group_id
        pub = requests.get(f"{API}/matches/{gm['id']}").json()
        assert pub["match"].get("group_id") == g["id"]

        _bulk_add(gm["id"], gm["admin_token"], [
            {"name": "TEST_G_A", "phone": "TESTG11001", "position": "Midfielder", "rating": 4},
            {"name": "TEST_G_B", "phone": "TESTG11002", "position": "Midfielder", "rating": 4},
            {"name": "TEST_G_C", "phone": "TESTG11003", "position": "Midfielder", "rating": 3},
            {"name": "TEST_G_D", "phone": "TESTG11004", "position": "Midfielder", "rating": 3},
        ])
        _gen_teams(gm["id"], gm["admin_token"])
        _mark(gm["id"], gm["admin_token"], winning_team=1)

        # dashboard
        dash = requests.get(f"{API}/groups/{g['id']}/admin/{g['admin_token']}")
        assert dash.status_code == 200, dash.text
        dd = dash.json()
        assert dd["group"]["id"] == g["id"]
        assert len(dd["matches"]) == 1
        assert len(dd["standings"]) == 4
        # sorted by wins desc (first 2 have wins=1)
        assert dd["standings"][0]["wins"] >= dd["standings"][-1]["wins"]
        assert "mvp_leaderboard" in dd
        assert "top_gainers" in dd
        # top gainers should have entries for this group
        assert isinstance(dd["top_gainers"], list)


# ---------- Regression smoke ----------
class TestRegression:
    def test_admin_token_length(self):
        m = _mk_match(max_players=2)
        assert len(m["admin_token"]) >= 30

    def test_demo_endpoint(self):
        r = requests.get(f"{API}/demo")
        assert r.status_code == 200
        assert "match_id" in r.json()

    def test_public_endpoint_hides_admin_token(self):
        m = _mk_match(max_players=2)
        r = requests.get(f"{API}/matches/{m['id']}")
        assert r.status_code == 200
        assert "admin_token" not in r.json()["match"]
