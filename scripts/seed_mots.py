import requests
BASE = "https://squad-balance-4.preview.emergentagent.com"

g = requests.post(f"{BASE}/api/groups", json={"name": "TEST_MOTS_Reveal2", "organizer_name": "Tester", "organizer_phone": "+390000000002"}).json()
group_id = g["id"]; g_admin = g["admin_token"]
print("Group:", group_id, g_admin)

for i in range(6):
    r = requests.post(f"{BASE}/api/groups/{group_id}/admin/{g_admin}/matches", json={
        "name": f"TEST_M{i}", "location": "Field A", "date_time": "2026-01-01T18:00:00", "players_per_team": 5, "num_teams": 2, "total_cost": 50, "max_players": 10
    })
    print(f"create-match {i}: {r.status_code} {r.text[:200]}")
    if r.status_code != 200: continue
    m = r.json()
    mid = m["id"]; adm = m["admin_token"]
    players = [{"name": f"P{i}_{j}", "phone": f"+399900{i}{j:03d}", "position": "MID", "self_declared_rating": 3} for j in range(10)]
    r = requests.post(f"{BASE}/api/matches/{mid}/admin/{adm}/bulk-add", json={"players": players})
    print(f"  bulk-add: {r.status_code} {r.text[:150]}")
    r = requests.post(f"{BASE}/api/matches/{mid}/admin/{adm}/generate-teams")
    print(f"  gen-teams: {r.status_code}")
    r = requests.post(f"{BASE}/api/matches/{mid}/admin/{adm}/mark-played", json={"winning_team": 1})
    print(f"  mark-played: {r.status_code}")

print(f"\nDASHBOARD_URL=/group/{group_id}/{g_admin}")
