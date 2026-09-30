# 🍃 GreenRoute: Enterprise Smart Waste Management Platform

[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg)](https://fastapi.tiangolo.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Security: Bcrypt & JWT](https://img.shields.io/badge/Security-Bcrypt%20%26%20JWT-red.svg)](https://jwt.io/)

GreenRoute is an IoT-inspired smart logistics and urban waste management platform designed for university campuses, corporate tech parks, and modern municipalities. By integrating data-driven fleet logistics, dynamic Travelling Salesperson (TSP) routing, and gamified citizen segregation incentives, GreenRoute dramatically reduces municipal fuel consumption while advancing a circular zero-waste economy.

---

## 🚀 Key Features

### 🏢 Smart Fleet Routing (Admin Command Center)
* **Dynamic Priority Routing:** Dynamic TSP nearest-neighbor algorithm that selectively routes trucks only to critical bins ($\ge 80\%$ full) or priority zones (campus health clinics/cafeterias $\ge 60\%$ full), slashing fuel usage by $>60\%$.
* **Spatial Heatmaps:** Visual fill-rate density overlays using Leaflet.heat to identify hotspot accumulation patterns before bin overflow occurs.
* **Sustainability Ticker:** Live automated calculation of Fuel Saved ($0.32\text{ L/km}$), $\text{CO}_2$ Prevented ($2.68\text{ kg CO}_2\text{/L}$ diesel), and Labor Hours conserved versus traditional static routes.
* **AI Operations Assistant:** Context-aware operations chat assistant answering logistics, fleet, and bin queries in real time.

### 👥 Green Citizen App (User Portal)
* **Gamified Recycling:** Citizens scan smart bins, log segregated materials (Plastic $+10\%$, Organic $+15\%$, E-Waste $+50\%$), and earn Green Points.
* **Streak & Rank Engine:** 5 rank tiers (`Novice Sprout` $\to$ `Gaia Master`) with multipliers for 3-day and 7-day recycling streaks.
* **Campus Leaderboard:** Live ranking system encouraging student and staff participation.
* **Reward Perks Catalog:** Redeem accumulated Green Points for vouchers (free campus coffee, eco gear, bike passes).

### 🔒 Enterprise Security & Governance
* **Bcrypt Password Hashing:** User passwords stored cryptographically salted with `bcrypt`.
* **Stateless JWT Authentication:** Cryptographically signed Bearer tokens (`HS256`) governing API access.
* **Role-Based Access Control (RBAC):** Strict separation between Citizen, Facilities Admin, and Head Authority.
* **Head Authority Governance:** New administrative accounts are queued in a `PENDING` state and require manual review, approval, and audit logging by a Head Admin before accessing dispatch controls.
* **Dual-Mode Resilient Architecture:** The frontend transparently auto-detects if the FastAPI backend is running; if offline, it seamlessly activates an in-browser simulation engine via `localStorage`.

---

## 🛠️ Tech Stack

* **Backend:** Python 3.10+, FastAPI, SQLAlchemy ORM, SQLite / PostgreSQL ready, Pydantic v2.
* **Security:** `bcrypt` (password hashing), `pyjwt` (JSON Web Tokens), OAuth2 Bearer guards.
* **Frontend:** Vanilla ES6+ JavaScript, Eco-Glassmorphism CSS3, HTML5.
* **Mapping & Spatial:** Leaflet.js & Leaflet.heat (OpenStreetMap tiles).
* **Audio Synthesizer:** Native Web Audio API (`sfx.js`) synthesizing UI soundscapes without external audio files.

---

## 🌍 Sustainable Development Goals (SDGs)
* **Goal 11 (Sustainable Cities & Communities):** Target 11.6 — Municipal waste management.
* **Goal 12 (Responsible Consumption & Production):** Target 12.5 — Waste reduction through segregation.
* **Goal 13 (Climate Action):** Direct reduction in fleet diesel consumption and carbon emissions.

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
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install requirements
pip install -r backend/requirements.txt
```

### 3. Initialize & Seed the Database
```bash
# Seeds smart bins, audit records, and demo accounts with bcrypt passwords
python -m backend.app.seed
```

### 4. Start the FastAPI Backend Server
```bash
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
* Interactive Swagger API Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* Health Check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### 5. Start the Frontend UI
In a separate terminal:
```bash
python -m http.server 5500 --directory frontend
```
* **Landing Page:** [http://127.0.0.1:5500/index.html](http://127.0.0.1:5500/index.html)
* **Citizen Portal:** [http://127.0.0.1:5500/citizen.html](http://127.0.0.1:5500/citizen.html)
* **Admin Command Center:** [http://127.0.0.1:5500/admin.html](http://127.0.0.1:5500/admin.html)
* **Approvals & Audit Log:** [http://127.0.0.1:5500/approvals.html](http://127.0.0.1:5500/approvals.html)

---

## 🔑 Demo Credentials

All seeded demo accounts use the standard password: `password123`

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Citizen (Student)** | `kushal@sou.edu.in` | `password123` | Citizen Dashboard, Waste Scanning, Rewards |
| **Facilities Admin** | `facilities.lead@sou.edu.in` | `password123` | Fleet Command Center, TSP Routing, Bin Telemetry |
| **Head Authority** | `head.authority@sou.edu.in` | `password123` | Approvals Portal, Access Governance, Audit Logs |

---

## 🧪 Running Automated Integration Tests
To verify all endpoints, JWT generation, password verification, and TSP algorithms:
```bash
python test_integration.py
```
Expected output:
```
✅ ALL INTEGRATION & SECURITY TESTS PASSED PERFECTLY! 🚀
```

---

## 📄 License
This project is open-source under the MIT License.
