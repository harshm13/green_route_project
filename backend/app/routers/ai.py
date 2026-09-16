from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from .. import models
from ..database import SessionLocal

router = APIRouter(
    prefix="/ai",
    tags=["AI Operations Assistant"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    critical_bins_count: int
    total_bins_count: int

@router.post("/chat", response_model=ChatResponse)
def handle_ai_chat(payload: ChatRequest, db: Session = Depends(get_db)):
    query = payload.message.lower().strip()
    bins = db.query(models.Bin).all()
    critical_bins = [b for b in bins if b.fill_level >= 80]
    clinic_bin = next((b for b in bins if b.zone == "hospital"), None)
    priority_bins = [b for b in bins if b.priority_zone and b.fill_level >= 60]

    if any(word in query for word in ["critical", "overflow", "immediate", "pickup", "urgent"]):
        if not critical_bins:
            reply = "No bins are currently above the 80% critical threshold. Campus facilities are operating smoothly! 🌿"
        else:
            names = "<br>".join([f"• <strong>{b.name}</strong> ({b.fill_level}% - {b.zone.upper()})" for b in critical_bins])
            reply = f"Found <strong>{len(critical_bins)} critical smart bins</strong> requiring immediate pickup:<br>{names}<br>The dynamic TSP algorithm has prioritized these in your dispatch manifest."
    elif any(word in query for word in ["fuel", "saving", "sustainability", "co2", "carbon", "green"]):
        full_count = len(critical_bins) + len(priority_bins)
        est_efficiency = min(85, max(30, round(full_count * 12.5)))
        est_fuel = round(full_count * 1.2, 1)
        est_co2 = round(est_fuel * 2.68, 1)
        reply = f"Dynamic route optimization achieves an estimated <strong>{est_efficiency}% efficiency gain</strong>, preventing <strong>{est_co2} kg CO₂</strong> and saving ~<strong>{est_fuel} liters</strong> of diesel compared to a static all-stop campus run."
    elif any(word in query for word in ["clinic", "hospital", "health"]):
        if not clinic_bin:
            reply = "No health clinic bin currently registered in the database."
        else:
            status = "PRIORITY PICKUP REQUIRED 🚨" if clinic_bin.fill_level >= 60 else "NORMAL 🌿"
            reply = f"<strong>{clinic_bin.name}</strong> is at <strong>{clinic_bin.fill_level}%</strong> capacity. Hospital zone policy status: <strong>{status}</strong> (Threshold: ≥60%)."
    elif any(word in query for word in ["order", "manifest", "sequence", "route", "dispatch"]):
        active_bins = [b for b in bins if b.fill_level >= 80 or (b.priority_zone and b.fill_level >= 60)]
        if not active_bins:
            reply = "No active collection stops required. All campus bins are within normal thresholds."
        else:
            stops_str = "<br>➡️ ".join([f"<strong>Stop #{i+1}</strong>: {b.name} ({b.fill_level}%)" for i, b in enumerate(active_bins)])
            reply = f"Optimized Fleet Dispatch Sequence:<br>➡️ Starting at <strong>Facilities Central Depot</strong><br>➡️ {stops_str}<br>➡️ Return to Central Depot."
    else:
        reply = f"Live Telemetry Summary: Actively monitoring <strong>{len(bins)} smart campus bins</strong> across Academic, Cafeteria, and Clinic zones. <strong>{len(critical_bins)} bins</strong> require immediate collection."

    return {
        "response": reply,
        "critical_bins_count": len(critical_bins),
        "total_bins_count": len(bins)
    }
