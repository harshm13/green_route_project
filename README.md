# 🍃 GreenRoute: Enterprise Smart Waste Management & Fleet Logistics Platform

[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg)](https://fastapi.tiangolo.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Security: Bcrypt & JWT](https://img.shields.io/badge/Security-Bcrypt%20%26%20JWT-red.svg)](https://jwt.io/)
[![Tests: 32 Passing](https://img.shields.io/badge/Tests-32%2F32%20Passing-brightgreen.svg)](test_integration.py)
[![IoT Telemetry: WebSockets](https://img.shields.io/badge/IoT%20Telemetry-WebSockets%20Live-purple.svg)](backend/app/routers/telemetry.py)

GreenRoute is an IoT-enabled smart logistics, fleet routing, and urban waste management platform engineered for university campuses, corporate tech parks, and modern municipalities. By uniting Capacitated Vehicle Routing (CVRP), OpenStreetMap road-network Traveling Salesperson (TSP) optimization, real-time IoT sensor telemetry, and gamified citizen recycling incentives, GreenRoute dramatically reduces municipal diesel fuel consumption while advancing a circular zero-waste economy.

---

## 🚀 Key Features

### 🏢 Smart Fleet Routing & Command Center (Admin Portal)
* **Dynamic Road Network TSP Routing:** High-performance nearest-neighbor TSP solver integrated with OpenStreetMap OSRM driving geometry, turn-by-turn steps, and actual road distances.
* **Documented Collection Thresholds:** Intelligently routes collection trucks only to critical bins ($\ge 80\%$ full) or priority zones ($\ge 60\%$ full), slashing fuel usage by $>60\%$ while preserving empty routes when no bins qualify.
* **CVRP Vehicle Capacity Protection:** Enforces vehicle payload limits (`truck_capacity`), automatically calculating utilization percentages and rejecting unsafe dispatches (`HTTP 400`) if demand exceeds capacity.
* **Standardized Stop Contract:** Delivers normalized `stop.step`, `stop.distanceFromPrevKm`, and nested `stop.bin` objects across web, mobile, and driver manifests.
* **Spatial Heatmaps:** Visual fill-rate density overlays via Leaflet.heat to predict hotspot accumulation patterns before overflows occur.
* **Sustainability Ticker:** Live calculations of Fuel Saved ($0.32\text{ L/km}$), $\text{CO}_2$ Prevented ($2.68\text{ kg CO}_2\text{/L}$ diesel), and Labor Hours conserved versus traditional static routes.

### 📡 Real-Time IoT Telemetry Hub & Hardware Simulator
* **WebSocket Live Streaming:** Low-latency bi-directional WebSocket hub (`/ws/telemetry`) streaming sensor fill levels, battery voltages, and critical alerts isolated strictly by tenant.
* **Role-Authorized Event Publishing:** Telemetry publishers (`POST /telemetry/broadcast`) are secured with JWT RBAC (`admin`, `head_admin`, `driver`) and strict Pydantic payload validation.
* **Dedicated Hardware Simulator:** Built-in Python CLI simulator (`iot_simulator.py`) emulating ultrasonic smart bin fill progression, battery discharge, and overflow broadcasts.

### 👥 Green Citizen Portal & Gamification
* **Gamified Segregation Incentives:** Citizens scan smart bins, log segregated materials (Plastic $+10\%$, Organic $+15\%$, E-Waste $+50\%$), and earn Green Points.
* **Streak & Rank Multiplier Engine:** 5 rank tiers (`Novice Sprout` $\to$ `Gaia Master`) with compound multipliers for 3-day and 7-day recycling streaks.
* **Campus Leaderboard:** Live ranking system encouraging student and staff participation.
* **Reward Perks Catalog:** Redeem accumulated Green Points for vouchers (campus coffee, eco gear, transit passes).

### 🏷️ Cryptographic Physical QR Codes & Smart Bin Vinyl Labels
* **HMAC-SHA256 Tokenized QR Codes:** High Error Correction (Level H - 30% recovery tolerance) QR codes embedding cryptographic verification tokens with server-side validation (`GET /{bin_id}/verify-qr`).
* **Print-Ready Vinyl Sticker Generator:** Automated 700x950px industrial composite badge generator (`GET /{bin_id}/qr-label`) with tenant branding, GPS coordinates, anti-counterfeit serials, and accepted material badges.
* **Geofence Anti-Spoofing Engine:** Verifies physical on-site presence using the Haversine formula ($\le 50\text{m}$ awards $+15\text{ pts}$ bonus; distance spoofing $> 200\text{m}$ is rejected with `HTTP 400`).
* **Transactional Replay Protection:** Enforces atomic nonces and immutable `ScanRecord` database tracking to prevent double-claiming or replaying scans.

### 📊 Audit-Ready ESG Carbon Accounting (Scope 1 & Scope 3)
* **GHG Protocol Standard:** Calculates Scope 1 direct fleet diesel combustion reductions and Scope 3 avoided landfill methane emissions.
* **Financial ROI Analytics:** Models municipal waste operational cost savings and tree seedling offsets.
* **Transparent Labeling:** Heuristic AI vision and ESG projections are clearly tagged (`is_heuristic_estimate: True`, `verification_status: "UNVERIFIED_ESTIMATE"`) while measured stats query real database records.

### 📱 Cross-Platform Mobile Application (React Native & Expo)
* **Dedicated Mobile Architecture:** Full architecture in [`mobile/`](mobile/) built with React Native, TypeScript, and Expo.
* **Hardware Camera & GPS Integration:** Powered by `expo-camera` (QR barcode detection) and `expo-location` (fine GPS geofencing).
* **Citizen & Driver Modes:** Citizen QR scanner & points claim vs. Fleet Driver turn-by-turn route navigation with server-confirmed collections via `markBinEmptied`.

### 🔒 Enterprise Multi-Tenancy & Access Governance
* **Multi-Tenant Campus Isolation:** Enforces strict boundary isolation across 3 campuses (*Silver Oak University*, *Ahmedabad Tech Hub*, and *Metro Health City*).
* **Bcrypt Password Hashing:** User passwords stored cryptographically salted with `bcrypt`.
* **Deployment-Specific JWT Secrets:** Cryptographic secret resolution (`.jwt_secret` / `JWT_SECRET`) with automatic invalidation and rejection of legacy fallback keys (`HTTP 401`).
* **Head Authority Governance:** Restricts approval and rejection actions strictly to `head_admin` roles, enforcing `PENDING` state transitions and immutable audit logs.
* **Zero Plaintext Frontend Storage:** Purged all sensitive plaintext passwords from client `localStorage`.

---

## 🛠️ Tech Stack

* **Backend:** Python 3.10+, FastAPI, SQLAlchemy ORM, SQLite / PostgreSQL ready, Pydantic v2, PyJWT, Bcrypt.
* **Frontend:** Vanilla HTML5, Eco-Glassmorphism CSS3, ES6+ JavaScript, Leaflet.js, Leaflet.heat, Web Audio API (`sfx.js`).
* **Mobile:** React Native, Expo SDK 52, TypeScript, Expo Camera, Expo Location, Expo Haptics.
* **Routing Engine:** OpenStreetMap OSRM Driving Road Network API.
* **Testing:** Custom automated regression & security test suite (32 tests covering positive flows, negative security, and contracts).

---

## 💻 Local Setup & Execution Guide

### 1. Clone the Repository
```bash
git clone https://github.com/harshm13/green_route_project.git
cd green_route_project
```

### 2. Set Up Virtual Environment & Dependencies
```bash
# Create and activate virtual environment
python -m venv .venv

# On Windows PowerShell:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt
```

### 3. Initialize & Seed Database (Non-Destructive)
```bash
# Safely seeds campuses, smart bins, and demo accounts with bcrypt passwords
python -m backend.app.seed

# (Optional: use --reset only if an explicit clean database wipe is desired)
# python -m backend.app.seed --reset
```

### 4. Start the FastAPI Backend Server
```bash
# From project root:
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload

# Or from backend/ directory:
# cd backend
# python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
* **Interactive Swagger API Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **Backend Health Check:** [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### 5. Start the Frontend Web Application
In a new terminal window:
```bash
cd frontend

# Option A: Via NPM (recommended)
npm install
npm run dev

# Option B: Via Python HTTP Server
# python -m http.server 5500
```
* **Landing Page:** [http://127.0.0.1:5500/index.html](http://127.0.0.1:5500/index.html)
* **Admin Command Center:** [http://127.0.0.1:5500/admin.html](http://127.0.0.1:5500/admin.html)
* **Citizen Portal & Scanner:** [http://127.0.0.1:5500/citizen.html](http://127.0.0.1:5500/citizen.html)
* **Driver Logistics Manifest:** [http://127.0.0.1:5500/driver.html](http://127.0.0.1:5500/driver.html)
* **Head Authority Approvals:** [http://127.0.0.1:5500/approvals.html](http://127.0.0.1:5500/approvals.html)

### 6. Run the Live IoT Sensor Fleet Simulator
In a separate terminal to watch real-time fill progression on the map:
```bash
# Run from project root:
python -m backend.app.iot_simulator --tenant sou --interval 2.5

# Or run from backend/ directory:
# python -m app.iot_simulator --tenant sou --interval 2.5
```

### 7. Run the Mobile App (React Native / Expo)
```bash
cd mobile
npm install
npx expo start
```

---

## 🔑 Demo Accounts & Credentials

All demo accounts are secured with bcrypt hashed passwords (`password123`):

| Role | Email | Password | Primary Portal / Capability |
| :--- | :--- | :--- | :--- |
| **Citizen (Student)** | `kushal@sou.edu.in` | `password123` | Citizen Portal, QR Segregation Scans, Leaderboard |
| **Facilities Admin** | `facilities.lead@sou.edu.in` | `password123` | Fleet Command Center, TSP Routing, Fill Heatmaps |
| **Fleet Driver** | `driver.ramesh@sou.edu.in` | `password123` | Driver Route Manifest, Mobile Bin Emptying |
| **Head Authority** | `head.authority@sou.edu.in` | `password123` | Access Governance, Admin Approvals, Audit Logs |

---

## 🧪 Automated Integration & Security Test Suite

The comprehensive regression suite tests all 32 positive flows, negative-security boundaries, and schema contracts:

```bash
# On Windows PowerShell:
$env:PYTHONIOENCODING="utf-8"; python test_integration.py

# On Linux/macOS:
PYTHONIOENCODING="utf-8" python test_integration.py
```

### Test Coverage Highlights:
- **Positive Flows**: Health, Bins, OSRM TSP Routing, Citizen Login, Head Admin Login, Approvals Workflow, Audit Logging, Computer Vision Classification, TTO Forecasting, Copilot Chat, Multi-Tenant Campus Isolation, ESG Scope 1/3 Reporting, Geofence Verification, Telemetry Broadcast.
- **Negative Security**: Unauthenticated scan rejection (`401`), cross-user point theft (`403`), public `head_admin` privilege escalation (`400`), deleted reseed attack surface (`404`), deprecated legacy JWT key invalidation (`401`), cross-tenant scan access violation (`403`), CVRP truck payload overload (`400`), and ordinary admin approval restriction (`403`).
- **Contract Verification**: Normalized `stop.step`, `stop.distanceFromPrevKm`, and `stop.bin` schema enforcement.

Expected output:
```
==================================================
🚀 ALL 32 INTEGRATION, SECURITY, AI, ESG & TELEMETRY TESTS PASSED! 🎉
==================================================
```

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
