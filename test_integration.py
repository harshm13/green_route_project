import urllib.request
import urllib.error
import json

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    print("==================================================")
    print("🍃 GREENROUTE INTEGRATION & SECURITY TEST SUITE")
    print("==================================================")

    # 1. Health Check
    print("\n--- 1. Testing Health Check ---")
    with urllib.request.urlopen(f"{BASE_URL}/api/health") as res:
        health = json.loads(res.read().decode())
        print("Health status:", health["status"], health["stats"])
        assert health["status"] == "healthy"
        assert health["stats"]["total_bins"] == 8

    # 2. Smart Bins Read Endpoint
    print("\n--- 2. Testing Smart Bins Endpoint ---")
    with urllib.request.urlopen(f"{BASE_URL}/bins/") as res:
        bins = json.loads(res.read().decode())
        print(f"Retrieved {len(bins)} bins. First bin:", bins[0]["name"], f"({bins[0]['fill_level']}%, {bins[0]['zone']})")
        assert len(bins) == 8
        assert "lat" in bins[0] and "lng" in bins[0]

    # 3. Dynamic TSP Route Optimization with OSRM Real Road Network
    print("\n--- 3. Testing Dynamic TSP Route Optimization (OSRM Road Network & CVRP) ---")
    with urllib.request.urlopen(f"{BASE_URL}/route/optimized?filter_mode=priority&truck_capacity=1500") as res:
        route_data = json.loads(res.read().decode())
        print("Depot:", route_data["depot"]["name"])
        print(f"Stops calculated: {len(route_data['stops'])}")
        print("Routing Engine:", route_data["routingEngine"])
        print(f"Road Distance: {route_data['roadDistanceKm']} km | Duration: {route_data['estimatedDurationMinutes']} mins")
        print("Road Coordinates Count:", len(route_data["geometry"]["coordinates"]))
        print("Truck Payload Metrics:", route_data["truckMetrics"])
        print("Sustainability Metrics:", route_data["metrics"])
        assert len(route_data["stops"]) > 0
        assert route_data["metrics"]["fuelSavedL"] > 0
        assert "geometry" in route_data and route_data["geometry"]["type"] == "LineString"
        assert len(route_data["geometry"]["coordinates"]) > 5
        assert route_data["estimatedDurationMinutes"] > 0
        assert "truckMetrics" in route_data
        assert route_data["truckMetrics"]["capacityLiters"] == 1500
        assert route_data["truckMetrics"]["utilizationPercent"] > 0

    # 4. Valid Citizen Login & JWT Token Issuance
    print("\n--- 4. Testing User Login with Valid Password & JWT Token ---")
    req = urllib.request.Request(
        f"{BASE_URL}/users/login",
        data=json.dumps({"email": "kushal@sou.edu.in", "password": "password123"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        user = json.loads(res.read().decode())
        print("Logged in user:", user["name"], f"({user['role']}, {user['points']} pts, {user['rank']})")
        print("Received JWT Token:", user["access_token"][:30] + "...")
        assert user["email"] == "kushal@sou.edu.in"
        assert "access_token" in user and len(user["access_token"]) > 20
        assert user["token_type"] == "bearer"
        citizen_token = user["access_token"]

    # 5. Invalid Password Authentication Guard (401)
    print("\n--- 5. Testing Invalid Password Rejection (401 Unauthorized) ---")
    req = urllib.request.Request(
        f"{BASE_URL}/users/login",
        data=json.dumps({"email": "kushal@sou.edu.in", "password": "wrong_password"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req)
        assert False, "Expected 401 Unauthorized, but request succeeded!"
    except urllib.error.HTTPError as e:
        print(f"Correctly caught HTTP {e.code}: {e.reason}")
        assert e.code == 401

    # 6. Head Admin Login & Admin JWT
    print("\n--- 6. Testing Head Authority Login ---")
    req = urllib.request.Request(
        f"{BASE_URL}/users/login",
        data=json.dumps({"email": "head.authority@sou.edu.in", "password": "password123"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        head_user = json.loads(res.read().decode())
        print("Head Admin logged in:", head_user["name"], f"({head_user['role']})")
        assert head_user["role"] == "head_admin"
        admin_token = head_user["access_token"]

    # 7. Unauthenticated Access to Protected Endpoint (401 / 403)
    print("\n--- 7. Testing Protected Admin Endpoint Without Token (401 Unauthorized) ---")
    req = urllib.request.Request(
        f"{BASE_URL}/admin/approvals",
        headers={}
    )
    try:
        urllib.request.urlopen(req)
        assert False, "Expected 401 Unauthorized on protected endpoint without token!"
    except urllib.error.HTTPError as e:
        print(f"Correctly blocked unauthenticated request: HTTP {e.code}")
        assert e.code == 401

    # 8. Authorized Access to Protected Admin Endpoint
    print("\n--- 8. Testing Protected Admin Endpoint With Bearer Token ---")
    req = urllib.request.Request(
        f"{BASE_URL}/admin/approvals",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    with urllib.request.urlopen(req) as res:
        approvals = json.loads(res.read().decode())

    if len(approvals) == 0:
        import time
        reg_payload = json.dumps({
            "name": "Test Candidate",
            "email": f"candidate_{int(time.time())}@sou.edu.in",
            "password": "password123",
            "role": "admin",
            "admin_id": "TEST-ADM",
            "department": "Logistics"
        }).encode()
        reg_req = urllib.request.Request(
            f"{BASE_URL}/users/register",
            data=reg_payload,
            headers={"Content-Type": "application/json"}
        )
        urllib.request.urlopen(reg_req)
        with urllib.request.urlopen(req) as res:
            approvals = json.loads(res.read().decode())

    print(f"Successfully retrieved pending admin approvals ({len(approvals)} pending)")
    assert len(approvals) >= 1
    approval_id = approvals[0]["id"]

    # 9. Head Admin Approving Pending Admin
    print("\n--- 9. Testing Admin Approval Workflow ---")
    req = urllib.request.Request(
        f"{BASE_URL}/admin/approvals/{approval_id}/approve",
        data=b"",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    with urllib.request.urlopen(req) as res:
        approved = json.loads(res.read().decode())
        print("Approved admin:", approved["name"], approved["status"])
        assert approved["status"] == "APPROVED"

    # 10. Audit Log Retrieval
    print("\n--- 10. Testing Access Governance Audit Log ---")
    req = urllib.request.Request(
        f"{BASE_URL}/admin/audit-log",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    with urllib.request.urlopen(req) as res:
        audit = json.loads(res.read().decode())
        print(f"Audit log count: {len(audit)}, latest entry: {audit[0]['action']} for {audit[0]['name']}")
        assert len(audit) >= 1

    # 11. Gamified Waste Segregation Scan
    print("\n--- 11. Testing Gamified Waste Segregation Scan ---")
    req = urllib.request.Request(
        f"{BASE_URL}/users/1/scan?waste_type=e-waste&bin_id=1",
        data=b"",
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        scan_res = json.loads(res.read().decode())
        print("Scan message:", scan_res["message"])
        print("Earned points:", scan_res["earned_points"], "Multiplier:", scan_res["multiplier"])
        print("New total points:", scan_res["new_total_points"])
        assert scan_res["status"] == "success"

    # 12. Global Leaderboard
    print("\n--- 12. Testing Global Leaderboard ---")
    with urllib.request.urlopen(f"{BASE_URL}/users/leaderboard") as res:
        lb = json.loads(res.read().decode())
        print(f"Leaderboard top {len(lb)} users:")
        for idx, u in enumerate(lb[:3]):
            print(f"  #{idx+1}: {u['name']} - {u['points']} pts ({u['rank']})")
        assert len(lb) > 0

    # 13. AI Operations Assistant Chat
    print("\n--- 13. Testing AI Operations Assistant Chat ---")
    req = urllib.request.Request(
        f"{BASE_URL}/ai/chat",
        data=json.dumps({"message": "Which bins are critical?"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        ai_reply = json.loads(res.read().decode())
        print("AI Response:", ai_reply["response"][:80] + "...")
        assert ai_reply["critical_bins_count"] >= 1

    # 14. Bin Fill-Level Update with Admin Authorization
    print("\n--- 14. Testing Bin Fill-Level Update with Admin Token ---")
    req = urllib.request.Request(
        f"{BASE_URL}/bins/3/fill-level?fill_level=95",
        data=b"",
        headers={"Authorization": f"Bearer {admin_token}"},
        method="PUT"
    )
    with urllib.request.urlopen(req) as res:
        updated_bin = json.loads(res.read().decode())
        print("Updated bin #3:", updated_bin["name"], f"Fill level: {updated_bin['fill_level']}%, Full: {updated_bin['is_full']}")
        assert updated_bin["fill_level"] == 95
        assert updated_bin["is_full"] == True

    # 15. Phase 3: AI Computer Vision Waste Classification
    print("\n--- 15. Testing AI Computer Vision Waste Classification ---")
    req = urllib.request.Request(
        f"{BASE_URL}/ai/classify-waste",
        data=json.dumps({"waste_sample": "plastic"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        vision_res = json.loads(res.read().decode())
        print(f"Classified Item: {vision_res['item_name']} ({vision_res['waste_type'].upper()})")
        print(f"Confidence: {round(vision_res['confidence'] * 100, 1)}% | Bin: {vision_res['recommended_bin']}")
        print(f"Disposal Guidance: {vision_res['disposal_instructions']}")
        assert vision_res["waste_type"] == "plastic"
        assert vision_res["confidence"] >= 0.85
        assert "Blue" in vision_res["recommended_bin"]

    # 16. Phase 3: Vision-Verified Atomic Scan & Points Credit
    print("\n--- 16. Testing Vision-Verified Atomic Citizen Scan ---")
    req = urllib.request.Request(
        f"{BASE_URL}/ai/verify-and-scan",
        data=json.dumps({
            "user_id": 1,
            "bin_id": 1,
            "waste_type": "metal"
        }).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        verified_scan = json.loads(res.read().decode())
        print("Verified Scan Status:", verified_scan["status"])
        print(f"Message: {verified_scan['message']}")
        print(f"Earned: {verified_scan['earned_points']} pts | New Total: {verified_scan['new_total_points']}")
        assert verified_scan["status"] == "success"
        assert verified_scan["earned_points"] > 0
        assert verified_scan["classification"]["waste_type"] == "metal"

    # 17. Phase 3: Predictive Fill-Rate & Overflow Forecasting
    print("\n--- 17. Testing Predictive Fill-Rate & Time-to-Overflow (TTO) Forecasting ---")
    with urllib.request.urlopen(f"{BASE_URL}/ai/forecast?horizon_hours=4") as res:
        forecast = json.loads(res.read().decode())
        print(f"Forecast Horizon: {forecast['horizon_hours']} hours | Total Bins: {forecast['total_bins']}")
        print(f"Imminent Overflows (<60m): {forecast['imminent_overflow_count']} | High Risk: {forecast['high_risk_count']}")
        top_f = forecast["forecasts"][0]
        print(f"Most Urgent Bin: {top_f['name']} (Current: {top_f['current_fill']}%, TTO: {top_f['time_to_overflow_minutes']} mins, Risk: {top_f['risk_level']})")
        assert len(forecast["forecasts"]) >= 1
        assert "time_to_overflow_minutes" in top_f
        assert "risk_level" in top_f

    # 18. Phase 3: Agentic Copilot with Structured Tool Action Execution
    print("\n--- 18. Testing Agentic Copilot with Map Action Intent ---")
    req = urllib.request.Request(
        f"{BASE_URL}/ai/chat",
        data=json.dumps({"message": "Focus on cafeteria zone"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        copilot_res = json.loads(res.read().decode())
        print("Copilot Response:", copilot_res["response"][:70] + "...")
        print("Dispatched Action:", copilot_res["action"])
        assert copilot_res["action"] is not None
        assert copilot_res["action"]["type"] == "FOCUS_ZONE"
        assert copilot_res["action"]["target"] == "cafeteria"

    # 19. Phase 4: Multi-Tenant Campus Bin Isolation
    print("\n--- 19. Testing Multi-Tenant Campus Bin Isolation ---")
    # SOU Campus
    with urllib.request.urlopen(f"{BASE_URL}/bins/?tenant_id=sou") as res:
        sou_bins = json.loads(res.read().decode())
        print(f"Retrieved {len(sou_bins)} bins for Silver Oak University (sou)")
        assert len(sou_bins) == 8
        assert all(b["tenant_id"] == "sou" for b in sou_bins)

    # Tech Hub Campus
    with urllib.request.urlopen(f"{BASE_URL}/bins/?tenant_id=tech_hub") as res:
        th_bins = json.loads(res.read().decode())
        print(f"Retrieved {len(th_bins)} bins for Ahmedabad Tech Hub (tech_hub). First: {th_bins[0]['name']}")
        assert len(th_bins) == 6
        assert all(b["tenant_id"] == "tech_hub" for b in th_bins)

    # Metro Health City Campus
    with urllib.request.urlopen(f"{BASE_URL}/bins/?tenant_id=metro_med") as res:
        mm_bins = json.loads(res.read().decode())
        print(f"Retrieved {len(mm_bins)} bins for Metro Health City (metro_med). First: {mm_bins[0]['name']}")
        assert len(mm_bins) == 6
        assert all(b["tenant_id"] == "metro_med" for b in mm_bins)

    # All Campuses Oversight
    with urllib.request.urlopen(f"{BASE_URL}/bins/?tenant_id=all") as res:
        all_campus_bins = json.loads(res.read().decode())
        print(f"Retrieved {len(all_campus_bins)} total bins across all 3 enterprise campuses")
        assert len(all_campus_bins) == 20

    # 20. Phase 4: Multi-Tenant Dynamic Route Optimization & Campus Depots
    print("\n--- 20. Testing Multi-Tenant Route Optimization & Campus Depots ---")
    with urllib.request.urlopen(f"{BASE_URL}/route/optimized?tenant_id=tech_hub&filter_mode=all") as res:
        th_route = json.loads(res.read().decode())
        print("Tech Hub Depot:", th_route["depot"]["name"])
        print(f"Tech Hub Stops: {len(th_route['stops'])}, Distance: {th_route['roadDistanceKm']} km")
        assert "Tech Hub" in th_route["depot"]["name"]
        assert len(th_route["stops"]) == 6
        assert th_route["roadDistanceKm"] > 0

    with urllib.request.urlopen(f"{BASE_URL}/route/optimized?tenant_id=metro_med&filter_mode=all") as res:
        mm_route = json.loads(res.read().decode())
        print("Metro Med Depot:", mm_route["depot"]["name"])
        print(f"Metro Med Stops: {len(mm_route['stops'])}, Distance: {mm_route['roadDistanceKm']} km")
        assert "Medical Fleet" in mm_route["depot"]["name"]
        assert len(mm_route["stops"]) == 6

    # 21. Phase 4: Audit-Ready ESG Carbon Accounting & Institutional ROI
    print("\n--- 21. Testing Audit-Ready ESG Carbon Accounting (Scope 1 & Scope 3) ---")
    with urllib.request.urlopen(f"{BASE_URL}/esg/tenants") as res:
        tenants = json.loads(res.read().decode())
        print(f"Retrieved {len(tenants)} registered enterprise tenants:")
        for t in tenants:
            print(f"  - {t['name']} ({t['facility_type']}) - ESG Target: {t['esg_target_reduction_pct']}% reduction")
        assert len(tenants) >= 3

    with urllib.request.urlopen(f"{BASE_URL}/esg/report?tenant_id=sou&timeframe=monthly") as res:
        esg_report = json.loads(res.read().decode())
        print("ESG Standard:", esg_report["standard"])
        print("Audit ID:", esg_report["audit_id"])
        print("Scope 1 (Diesel Avoided):", esg_report["carbon_accounting"]["scope_1"])
        print("Scope 3 (Landfill Methane Avoided):", esg_report["carbon_accounting"]["scope_3"]["emissions_avoided_kg_co2e"], "kg CO2e")
        print("Aggregate Net Offset:", esg_report["carbon_accounting"]["aggregate_totals"]["total_ghg_avoided_metric_tons"], "MT CO2e")
        print("Trees Equivalent:", esg_report["carbon_accounting"]["aggregate_totals"]["equivalent_trees_seedlings"], "seedlings")
        print("Financial Net ROI:", f"+{esg_report['financial_roi']['roi_percentage']}% (Net Savings: ₹{esg_report['financial_roi']['net_savings_inr']})")
        assert "GHG Protocol" in esg_report["standard"]
        assert esg_report["carbon_accounting"]["scope_1"]["diesel_saved_liters"] > 0
        assert esg_report["carbon_accounting"]["scope_3"]["emissions_avoided_kg_co2e"] > 0
        assert esg_report["circular_metrics"]["circular_purity_score"] > 70
        assert esg_report["financial_roi"]["net_savings_inr"] > 0

    # 22. Phase 4: Geofence Anti-Fraud Proximity Engine
    print("\n--- 22. Testing Geofence Anti-Fraud Proximity Verification ---")
    # Subtest A: Close physical proximity (<= 50m) at Bin 1 (23.0841, 72.5448)
    req_verified = urllib.request.Request(
        f"{BASE_URL}/ai/verify-and-scan",
        data=json.dumps({
            "user_id": 1,
            "bin_id": 1,
            "waste_type": "plastic",
            "user_lat": 23.08412,
            "user_lng": 72.54481
        }).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_verified) as res:
        geo_res = json.loads(res.read().decode())
        print(f"Verified Geofence Status: {geo_res['geofence']['status']} (Dist: {geo_res['geofence']['distance_meters']}m, Bonus: +{geo_res['geofence']['bonus_points']} pts)")
        assert geo_res["geofence"]["status"] == "VERIFIED_ON_SITE"
        assert geo_res["geofence"]["verified"] == True
        assert geo_res["geofence"]["bonus_points"] == 15

    # Subtest B: Distance spoofing detected (> 200m away, e.g. 15 km away)
    req_spoof = urllib.request.Request(
        f"{BASE_URL}/ai/verify-and-scan",
        data=json.dumps({
            "user_id": 1,
            "bin_id": 1,
            "waste_type": "plastic",
            "user_lat": 23.0000,
            "user_lng": 72.4000
        }).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_spoof) as res:
        spoof_res = json.loads(res.read().decode())
        print(f"Spoofed Geofence Status: {spoof_res['geofence']['status']} (Dist: {spoof_res['geofence']['distance_meters']}m)")
        assert spoof_res["geofence"]["status"] == "SPOOF_FLAGGED"
        assert spoof_res["geofence"]["verified"] == False
        assert spoof_res["geofence"]["bonus_points"] == 0

    # 23. Phase 4: Real-Time Telemetry Hub & Broadcast Event
    print("\n--- 23. Testing Real-Time Telemetry Hub Broadcast ---")
    req_telemetry = urllib.request.Request(
        f"{BASE_URL}/telemetry/broadcast",
        data=json.dumps({
            "event_type": "SENSOR_UPDATE",
            "payload": {
                "bin_id": 1,
                "tenant_id": "sou",
                "fill_level": 94,
                "battery_voltage": 3.92,
                "signal_rssi": -68,
                "status": "CRITICAL_OVERFLOW"
            }
        }).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_telemetry) as res:
        tel_res = json.loads(res.read().decode())
        print("Telemetry Broadcast Status:", tel_res["status"], f"(Active Clients: {tel_res['active_clients']})")
        assert tel_res["status"] == "broadcast_sent"
        assert tel_res["packet"]["payload"]["status"] == "CRITICAL_OVERFLOW"

    print("\n==================================================")
    print("🚀 ALL 23 INTEGRATION, AI, ESG & TELEMETRY TESTS PASSED! 🎉")
    print("==================================================")

if __name__ == "__main__":
    test_api()

