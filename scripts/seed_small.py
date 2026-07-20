import requests
BASE = "https://squad-balance-4.preview.emergentagent.com"
g = requests.post(f"{BASE}/api/groups", json={"name": "TEST_MOTS_Small", "organizer_name": "Tester", "organizer_phone": "+390000000099"}).json()
gid=g["id"]; adm=g["admin_token"]
for i in range(3):
    r = requests.post(f"{BASE}/api/groups/{gid}/admin/{adm}/matches", json={
        "name": f"S{i}", "location": "F", "date_time": "2026-01-01T18:00:00", "players_per_team": 5, "num_teams": 2, "total_cost": 50, "max_players": 10
    }).json()
    requests.post(f"{BASE}/api/matches/{r['id']}/admin/{r['admin_token']}/mark-played", json={"winning_team": 1})
print(f"URL=/group/{gid}/{adm}")
