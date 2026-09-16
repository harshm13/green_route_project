import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    print("--- 1. Testing Health Check ---")
    with urllib.request.urlopen(f"{BASE_URL}/api/health") as res:
        health = json.loads(res.read().decode())
        print("Health status:", health["status"], health["stats"])
        assert health["status"] == "healthy"
        assert health["stats"]["total_bins"] == 8

    print("\n--- 2. Testing Smart Bins Endpoint ---")
    with urllib.request.urlopen(f"{BASE_URL}/bins/") as res:
        bins = json.loads(res.read().decode())
        print(f"Retrieved {len(bins)} bins. First bin:", bins[0]["name"], f"({bins[0]['fill_level']}%, {bins[0]['zone']})")
        assert len(bins) == 8
        assert "lat" in bins[0] and "lng" in bins[0]

    print("\n--- 3. Testing Dynamic TSP Route Optimization ---")
    with urllib.request.urlopen(f"{BASE_URL}/route/optimized?filter_mode=priority") as res:
        route_data = json.loads(res.read().decode())
        print("Depot:", route_data["depot"]["name"])
        print(f"Stops calculated: {len(route_data['stops'])}")
        print("Metrics:", route_data["metrics"])
        print("Message:", route_data["message"])
        assert len(route_data["stops"]) > 0
        assert route_data["metrics"]["fuelSavedL"] > 0

    print("\n--- 4. Testing User Login ---")
    req = urllib.request.Request(
        f"{BASE_URL}/users/login",
        data=json.dumps({"email": "kushal@sou.edu.in"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        user = json.loads(res.read().decode())
        print("Logged in user:", user["name"], f"({user['role']}, {user['points']} pts, {user['rank']})")
        assert user["email"] == "kushal@sou.edu.in"

    print("\n--- 5. Testing Gamified Waste Segregation Scan ---")
    req = urllib.request.Request(
        f"{BASE_URL}/users/1/scan?waste_type=e-waste&bin_id=1",
        data=b"",
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        scan_res = json.loads(res.read().decode())
        print("Scan result:", scan_res["message"])
        print("Earned points:", scan_res["earned_points"], "Multiplier:", scan_res["multiplier"])
        print("New total points:", scan_res["new_total_points"])
        assert scan_res["status"] == "success"

    print("\n--- 6. Testing Leaderboard ---")
    with urllib.request.urlopen(f"{BASE_URL}/users/leaderboard") as res:
        lb = json.loads(res.read().decode())
        print(f"Leaderboard top {len(lb)} users:")
        for idx, u in enumerate(lb[:3]):
            print(f"  #{idx+1}: {u['name']} - {u['points']} pts ({u['rank']})")
        assert len(lb) > 0

    print("\n--- 7. Testing Admin Approvals & Audit Log ---")
    with urllib.request.urlopen(f"{BASE_URL}/admin/approvals") as res:
        approvals = json.loads(res.read().decode())
        print(f"Pending admin requests count: {len(approvals)}")
        assert len(approvals) >= 1

    app_id = approvals[0]["id"]
    req = urllib.request.Request(f"{BASE_URL}/admin/approvals/{app_id}/approve", data=b"", headers={})
    with urllib.request.urlopen(req) as res:
        approved = json.loads(res.read().decode())
        print("Approved admin:", approved["name"], approved["status"])
        assert approved["status"] == "APPROVED"

    with urllib.request.urlopen(f"{BASE_URL}/admin/audit-log") as res:
        audit = json.loads(res.read().decode())
        print(f"Audit log records count: {len(audit)}, latest action: {audit[0]['action']} for {audit[0]['name']}")
        assert len(audit) >= 1

    print("\n--- 8. Testing AI Operations Assistant Chat ---")
    req = urllib.request.Request(
        f"{BASE_URL}/ai/chat",
        data=json.dumps({"message": "Which bins are critical?"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        ai_reply = json.loads(res.read().decode())
        print("AI Response:", ai_reply["response"])
        assert ai_reply["critical_bins_count"] >= 1

    print("\n--- 9. Testing Bin Fill-Level Update ---")
    req = urllib.request.Request(f"{BASE_URL}/bins/3/fill-level?fill_level=95", data=b"", headers={}, method="PUT")
    with urllib.request.urlopen(req) as res:
        updated_bin = json.loads(res.read().decode())
        print("Updated bin #3:", updated_bin["name"], f"Fill level: {updated_bin['fill_level']}%, Full: {updated_bin['is_full']}")
        assert updated_bin["fill_level"] == 95
        assert updated_bin["is_full"] == True

    print("\n✅ ALL INTEGRATION TESTS PASSED PERFECTLY! 🚀")

if __name__ == "__main__":
    test_api()
