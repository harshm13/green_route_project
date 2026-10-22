"""
GreenRoute - IoT Smart Bin Hardware & Telemetry Simulator
Simulates real-world ultrasonic distance sensors, LoRaWAN / 4G telemetry transmissions,
battery voltage decay, and real-time overflow alerts streaming to the FastAPI Telemetry Hub.
"""

import sys
import time
import random
import json
import argparse
import urllib.request
import urllib.error

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://127.0.0.1:8000"

def get_auth_token(email: str = "facilities.lead@sou.edu.in", password: str = "password123") -> str:
    """Authenticates admin or driver to publish telemetry events."""
    payload = json.dumps({"email": email, "password": password}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/users/login",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=5) as res:
        data = json.loads(res.read().decode("utf-8"))
        return data["access_token"]

def fetch_bins(tenant_id: str = "sou") -> list:
    """Fetches active smart bins for the campus."""
    with urllib.request.urlopen(f"{BASE_URL}/bins/?tenant_id={tenant_id}", timeout=5) as res:
        return json.loads(res.read().decode("utf-8"))

def broadcast_telemetry(token: str, event_type: str, payload: dict) -> dict:
    """Sends authenticated telemetry packet to the WebSocket Hub."""
    data = json.dumps({"event_type": event_type, "payload": payload}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/telemetry/broadcast",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        }
    )
    with urllib.request.urlopen(req, timeout=5) as res:
        return json.loads(res.read().decode("utf-8"))

def run_simulation(tenant_id: str = "sou", interval: float = 3.0, iterations: int = 0):
    print("==================================================")
    print("📡 GREENROUTE REAL-TIME IoT SENSOR FLEET SIMULATOR")
    print("==================================================")
    print(f"Target Campus Tenant: {tenant_id.upper()}")
    print(f"Backend Server: {BASE_URL}")
    print(f"Broadcast Interval: {interval}s")
    print("Press Ctrl+C to stop simulation at any time.\n")

    try:
        token = get_auth_token()
        print(" Connected to Telemetry Hub with Admin Credentials.")
    except Exception as e:
        print(f"❌ Failed to authenticate with backend: {e}")
        print("Please ensure the FastAPI backend is running on http://127.0.0.1:8000")
        return

    try:
        bins = fetch_bins(tenant_id)
        print(f" Found {len(bins)} registered smart bins with ultrasonic sensors.\n")
    except Exception as e:
        print(f"❌ Failed to fetch bins: {e}")
        return

    # Track in-memory simulated levels
    state = {b["id"]: {"name": b["name"], "fill": b["fill_level"], "batt": 3.9} for b in bins}

    cycle = 0
    while True:
        cycle += 1
        if iterations > 0 and cycle > iterations:
            break

        # Pick 1-2 random bins to simulate waste deposit or sensor fluctuation
        selected_id = random.choice(list(state.keys()))
        current = state[selected_id]

        # Natural fill increase (1% to 6%)
        delta = random.choice([1, 2, 3, 5, -20]) if current["fill"] > 85 else random.randint(1, 5)
        new_fill = max(0, min(100, current["fill"] + delta))
        current["fill"] = new_fill

        # Battery voltage with slight micro-drain
        current["batt"] = round(max(3.5, min(4.2, current["batt"] - random.uniform(0.001, 0.005))), 2)

        # Status classification
        if new_fill >= 80:
            status = "CRITICAL_OVERFLOW"
            event_type = "CRITICAL_OVERFLOW"
            badge = "🔴 OVERFLOW ALERT"
        elif new_fill >= 60:
            status = "HIGH_FILL"
            event_type = "SENSOR_UPDATE"
            badge = "🟡 ELEVATED"
        else:
            status = "NORMAL"
            event_type = "SENSOR_UPDATE"
            badge = "🟢 NOMINAL"

        packet = {
            "bin_id": selected_id,
            "tenant_id": tenant_id,
            "fill_level": new_fill,
            "battery_voltage": current["batt"],
            "signal_rssi": random.randint(-82, -58),
            "status": status
        }

        try:
            res = broadcast_telemetry(token, event_type, packet)
            active_subscribers = res.get("active_clients", 0)
            timestamp = time.strftime("%H:%M:%S")
            print(f"[{timestamp}] Bin #{selected_id:02d} ({current['name'][:24]:<24}) | "
                  f"Fill: {new_fill:3d}% {badge:<16} | Batt: {current['batt']}V | "
                  f"Clients: {active_subscribers}")
        except urllib.error.HTTPError as e:
            if e.code == 401:
                # Refresh token
                token = get_auth_token()
            else:
                print(f"⚠️ Broadcast error (HTTP {e.code}): {e.reason}")
        except Exception as e:
            print(f"⚠️ Sensor telemetry error: {e}")

        time.sleep(interval)

    print("\n✅ Simulation cycle completed.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GreenRoute Real-Time IoT Sensor Simulator")
    parser.add_argument("--tenant", default="sou", help="Tenant ID (sou, tech_hub, metro_med)")
    parser.add_argument("--interval", type=float, default=3.0, help="Broadcast interval in seconds")
    parser.add_argument("--count", type=int, default=0, help="Max iterations (0 = infinite)")
    args = parser.parse_args()

    run_simulation(tenant_id=args.tenant, interval=args.interval, iterations=args.count)
