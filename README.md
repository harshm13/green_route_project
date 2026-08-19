# 🍃 GreenRoute: Smart Waste Management Platform

GreenRoute is an interdisciplinary, IoT-inspired web application designed to tackle modern urban waste management challenges. By blending data-driven logistics, AI integrations, and human psychology, this project modernizes traditional garbage collection while actively promoting a circular economy.

## 🚀 Key Features

### 🏢 Smart Fleet Routing (Admin Command Center)
* **Dynamic Priority Routing:** Utilizes Leaflet.js to map smart bins. The routing algorithm dynamically calculates paths connecting only critical bins (>= 80% full) or High-Priority zones (hospitals/cafeterias >= 60% full), drastically reducing fuel consumption.
* **Predictive Heatmaps:** Overlays historical fill-rate data to predict future hotspots, allowing for proactive fleet dispatching.
* **AI Operations Assistant:** An integrated chat widget that parses live bin data to provide administrators with actionable, real-time insights.
* **Sustainability Ticker:** Live calculation of Fuel Saved, CO2 Prevented, and Labor Hours conserved based on the optimized route vs. traditional fixed routes.

### 👥 Green Citizen App (User Portal)
* **Gamified Recycling:** Users scan QR codes at smart bins to log their segregated waste, earning "Green Points."
* **Campus Leaderboard:** A competitive, real-time ranking system encouraging students and citizens to maintain their recycling streaks.
* **Reward Catalog:** Users can redeem their accumulated points for campus perks (e.g., free coffee, merchandise).

### 🔒 Enterprise-Grade Security
* **Role-Based Access Control (RBAC):** Strict separation between Citizen and Admin portals.
* **Head Authority Approvals:** New administrator accounts are placed in a pending state and require manual approval or rejection from a Head Admin via a dedicated, secure dashboard using SweetAlert2 interactions.
* **Eco-Glassmorphism UI:** A highly polished, responsive interface utilizing soft shadows, frosted glass effects, and `particles.js` for an immersive user experience.

## 🛠️ Tech Stack

**Frontend Architecture:**
* HTML5, CSS3 (Eco-Glassmorphism UI)
* Vanilla JavaScript (ES6+)
* Leaflet.js & Leaflet.heat (Interactive Mapping & Spatial Data)
* SweetAlert2 (Polished Modals & Alerts)
* Particles.js (Interactive Backgrounds)

**Backend Architecture (Planned/In Progress):**
* Python 3.13
* FastAPI framework
* MongoDB (NoSQL Database)

## 🌍 Sustainable Development Goals (SDGs) Addressed
This project directly aligns with the United Nations SDGs:
* **Goal 11:** Sustainable Cities and Communities (Target 11.6: Municipal waste management)
* **Goal 12:** Responsible Consumption and Production (Target 12.5: Substantially reduce waste generation through recycling)
* **Goal 13:** Climate Action (Reducing fleet emissions through optimized routing)

## 💻 Local Setup & Testing

Since the frontend is built with pure Vanilla JavaScript and utilizes mocked JSON data for review purposes, no complex build tools are required to run the UI.

1. Clone the repository:
   ```bash
   git clone [https://github.com/harshm13/green_route_project.git](https://github.com/harshm13/green_route_project.git)