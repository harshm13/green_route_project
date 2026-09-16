from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from .. import models
from ..database import SessionLocal
import math

router = APIRouter(
    prefix="/route",
    tags=["Routing Engine"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- ALGORITHM HELPER: Real Earth Distance (Haversine) ---
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

DEPOT = {
    "name": "Facilities Central Depot",
    "lat": 23.0822,
    "lng": 72.5460
}

# --- API ENDPOINTS ---
@router.get("/optimized")
def get_optimized_route(
    filter_mode: str = Query("priority", description="Filter mode: priority, critical, priority_zones, all_full"),
    db: Session = Depends(get_db)
):
    # 1. Fetch all bins from database
    all_bins = db.query(models.Bin).all()

    # 2. Filter bins that require collection based on mode
    target_bins = []
    if filter_mode == "critical":
        target_bins = [b for b in all_bins if b.fill_level >= 80]
    elif filter_mode == "priority_zones":
        target_bins = [b for b in all_bins if b.priority_zone and b.fill_level >= 60]
    elif filter_mode == "all_full":
        target_bins = [b for b in all_bins if b.is_full]
    else:
        # Default Smart Priority Rule: Critical (>=80%) or Priority Zone (>=60%)
        target_bins = [b for b in all_bins if b.fill_level >= 80 or (b.priority_zone and b.fill_level >= 60)]

    if not target_bins:
        return {
            "depot": DEPOT,
            "stops": [],
            "totalDistanceKm": 0.0,
            "returnDistanceKm": 0.0,
            "metrics": {
                "fuelSavedL": 0.0,
                "co2PreventedKg": 0.0,
                "laborHoursSaved": 0.0,
                "efficiencyGainPercent": 0
            },
            "message": "All clear! No bins currently meet the priority threshold. 🌿"
        }

    # 3. Nearest Neighbor TSP starting from Central Depot
    unvisited = target_bins.copy()
    current_lat = DEPOT["lat"]
    current_lng = DEPOT["lng"]
    ordered_route = []
    total_distance_km = 0.0

    while unvisited:
        nearest_idx = 0
        min_dist = float("inf")

        for idx, candidate in enumerate(unvisited):
            dist = haversine_km(current_lat, current_lng, candidate.latitude, candidate.longitude)
            if dist < min_dist:
                min_dist = dist
                nearest_idx = idx

        next_bin = unvisited.pop(nearest_idx)
        total_distance_km += min_dist

        bin_dict = {
            "id": next_bin.id,
            "name": next_bin.name,
            "zone": next_bin.zone,
            "priority_zone": next_bin.priority_zone,
            "lat": next_bin.latitude,
            "lng": next_bin.longitude,
            "latitude": next_bin.latitude,
            "longitude": next_bin.longitude,
            "fill_level": next_bin.fill_level,
            "is_full": next_bin.is_full,
            "capacity": next_bin.capacity,
            "last_emptied": next_bin.last_emptied
        }

        ordered_route.append({
            "step": len(ordered_route) + 1,
            "bin": bin_dict,
            "distanceFromPrevKm": round(min_dist, 2)
        })

        current_lat = next_bin.latitude
        current_lng = next_bin.longitude

    # 4. Return leg to central depot
    return_dist = haversine_km(current_lat, current_lng, DEPOT["lat"], DEPOT["lng"])
    total_distance_km += return_dist

    # 5. Sustainability calculations vs baseline (14.8 km traditional static route)
    baseline_distance_km = 14.8
    distance_saved_km = max(0.0, baseline_distance_km - total_distance_km)
    fuel_saved_l = round(distance_saved_km * 0.32, 1)
    co2_prevented_kg = round(fuel_saved_l * 2.68, 1)
    labor_hours_saved = round(distance_saved_km * 0.08, 1)
    efficiency_gain_percent = min(85, round((distance_saved_km / baseline_distance_km) * 100))

    return {
        "depot": DEPOT,
        "stops": ordered_route,
        "totalDistanceKm": round(total_distance_km, 2),
        "returnDistanceKm": round(return_dist, 2),
        "metrics": {
            "fuelSavedL": fuel_saved_l,
            "co2PreventedKg": co2_prevented_kg,
            "laborHoursSaved": labor_hours_saved,
            "efficiencyGainPercent": efficiency_gain_percent
        },
        "message": f"Optimal route generated: {len(ordered_route)} priority stops • {efficiency_gain_percent}% fuel efficiency gain."
    }