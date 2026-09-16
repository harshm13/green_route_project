from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from .. import models
from ..database import SessionLocal

router = APIRouter(
    prefix="/bins",
    tags=["Smart Bins"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- PYDANTIC SCHEMAS ---
class BinCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    zone: str = "academic"
    priority_zone: bool = False
    fill_level: int = 50
    capacity: int = 240
    is_full: bool = False

class BinResponse(BaseModel):
    id: int
    name: str
    zone: str
    priority_zone: bool
    latitude: float
    longitude: float
    lat: float
    lng: float
    fill_level: int
    is_full: bool
    capacity: int
    last_emptied: Optional[str] = None

    class Config:
        from_attributes = True

# --- API ENDPOINTS ---

# 1. Add a new bin to the campus
@router.post("/", response_model=BinResponse)
def create_bin(bin_data: BinCreate, db: Session = Depends(get_db)):
    db_bin = models.Bin(**bin_data.model_dump())
    db.add(db_bin)
    db.commit()
    db.refresh(db_bin)
    return db_bin

# 2. Get all bins for the Leaflet Map
@router.get("/", response_model=List[BinResponse])
def get_all_bins(db: Session = Depends(get_db)):
    return db.query(models.Bin).all()

# 3. Update a bin's status (Empty vs. Full)
@router.put("/{bin_id}/status", response_model=BinResponse)
def update_bin_status(bin_id: int, is_full: bool, db: Session = Depends(get_db)):
    db_bin = db.query(models.Bin).filter(models.Bin.id == bin_id).first()
    if not db_bin:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    db_bin.is_full = is_full
    if is_full:
        db_bin.fill_level = max(85, db_bin.fill_level)
    else:
        db_bin.fill_level = min(15, db_bin.fill_level)
        db_bin.last_emptied = datetime.now().strftime("%Y-%m-%d %H:%M")
        
    db.commit()
    db.refresh(db_bin)
    return db_bin

# 4. Update fill level directly (from slider / sensor)
@router.put("/{bin_id}/fill-level", response_model=BinResponse)
def update_bin_fill_level(bin_id: int, fill_level: int, db: Session = Depends(get_db)):
    db_bin = db.query(models.Bin).filter(models.Bin.id == bin_id).first()
    if not db_bin:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    db_bin.fill_level = fill_level
    # Critical if >= 80% or priority zone >= 60%
    is_priority_critical = db_bin.priority_zone and db_bin.fill_level >= 60
    db_bin.is_full = db_bin.fill_level >= 80 or is_priority_critical
    
    db.commit()
    db.refresh(db_bin)
    return db_bin

# 5. Re-seed bins if empty
@router.post("/seed")
def seed_bins(db: Session = Depends(get_db)):
    from ..seed import seed_database
    seed_database()
    return {"status": "success", "message": "Campus bins and demo data re-seeded successfully!"}