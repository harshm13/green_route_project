from fastapi import APIRouter, Depends, HTTPException, Query, Response, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from .. import models
from ..database import SessionLocal
from ..auth_utils import require_role

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
    tenant_id: str = "sou"
    zone: str = "academic"
    priority_zone: bool = False
    fill_level: int = 50
    capacity: int = 240
    is_full: bool = False

class BinResponse(BaseModel):
    id: int
    tenant_id: str = "sou"
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

# 1. Add a new bin to the campus (Admin only)
@router.post("/", response_model=BinResponse)
def create_bin(
    bin_data: BinCreate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role(["admin", "head_admin"]))
):
    db_bin = models.Bin(**bin_data.model_dump())
    db.add(db_bin)
    db.commit()
    db.refresh(db_bin)
    return db_bin

# 2. Get all bins for the Leaflet Map (Public read, multi-tenant)
@router.get("/", response_model=List[BinResponse])
def get_all_bins(
    tenant_id: Optional[str] = Query(None, description="Filter bins by organization tenant ('sou' | 'tech_hub' | 'metro_med' | 'all')"),
    db: Session = Depends(get_db)
):
    if tenant_id and tenant_id.lower() != "all":
        return db.query(models.Bin).filter(models.Bin.tenant_id == tenant_id).all()
    elif tenant_id is None:
        # Default to Silver Oak University if none specified
        return db.query(models.Bin).filter(models.Bin.tenant_id == "sou").all()
    return db.query(models.Bin).all()

# 3. Update a bin's status (Empty vs. Full) - Admin & Driver
@router.put("/{bin_id}/status", response_model=BinResponse)
def update_bin_status(
    bin_id: int,
    is_full: bool,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role(["admin", "head_admin", "driver"]))
):
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

# 4. Update fill level directly (from sensor / slider) - Admin & Driver
@router.put("/{bin_id}/fill-level", response_model=BinResponse)
def update_bin_fill_level(
    bin_id: int,
    fill_level: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role(["admin", "head_admin", "driver"]))
):
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

# --- REAL PRODUCTION QR & PHYSICAL BIN LABEL SYSTEM ---

# 5. Verify a Scanned Physical Bin QR Token
@router.get("/{bin_id}/verify-qr", summary="Verify physical bin QR code token against server secret")
def verify_qr(
    bin_id: int,
    token: str = Query(..., description="Cryptographic QR token scanned from bin label"),
    db: Session = Depends(get_db)
):
    bin_obj = db.query(models.Bin).filter(models.Bin.id == bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    from ..qr_service import verify_bin_qr_token
    valid = verify_bin_qr_token(bin_id=bin_obj.id, tenant_id=bin_obj.tenant_id, token=token)
    return {
        "status": "success" if valid else "invalid",
        "valid": valid,
        "bin_id": bin_obj.id,
        "tenant_id": bin_obj.tenant_id,
        "name": bin_obj.name
    }

# 6. Get Raw Scannable QR Matrix Image (PNG)
@router.get("/{bin_id}/qr", summary="Generate real scannable QR code PNG for a smart bin")
def get_bin_qr_image(
    bin_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    bin_obj = db.query(models.Bin).filter(models.Bin.id == bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    import os
    from ..qr_service import generate_bin_qr_code, DEFAULT_FRONTEND_URL
    frontend_url = os.getenv("FRONTEND_URL", DEFAULT_FRONTEND_URL)
    img = generate_bin_qr_code(bin_id=bin_obj.id, tenant_id=bin_obj.tenant_id, frontend_url=frontend_url)
    
    import io
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")

# 7. Get High-Resolution Printable Physical Bin Sticker Label (PNG)
@router.get("/{bin_id}/qr-label", summary="Generate full printable vinyl sticker badge with branding, geofence, and QR")
def get_bin_printable_label(
    bin_id: int,
    request: Request,
    download: bool = Query(False, description="Set true to trigger browser file download"),
    db: Session = Depends(get_db)
):
    bin_obj = db.query(models.Bin).filter(models.Bin.id == bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")
        
    import os
    from ..qr_service import generate_printable_bin_label, DEFAULT_FRONTEND_URL
    frontend_url = os.getenv("FRONTEND_URL", DEFAULT_FRONTEND_URL)
    
    bin_dict = {
        "id": bin_obj.id,
        "name": bin_obj.name,
        "tenant_id": bin_obj.tenant_id,
        "zone": bin_obj.zone,
        "latitude": bin_obj.latitude,
        "longitude": bin_obj.longitude
    }
    
    label_bytes = generate_printable_bin_label(bin_dict, frontend_url=frontend_url)
    headers = {}
    if download:
        filename = f"greenroute_sticker_bin_{bin_obj.id:03d}.png"
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'
        
    return Response(content=label_bytes, media_type="image/png", headers=headers)

# 8. Download all printable QR labels as a ZIP bundle
@router.get("/qr-codes/download-all", summary="Batch download all campus smart bin physical labels as ZIP")
def download_all_qr_labels(
    request: Request,
    tenant_id: Optional[str] = Query(None, description="Optional tenant filter"),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role(["admin", "head_admin"]))
):
    query = db.query(models.Bin)
    if tenant_id and tenant_id.lower() != "all":
        query = query.filter(models.Bin.tenant_id == tenant_id)
    bins = query.all()
    
    import os
    from ..qr_service import generate_all_labels_zip, DEFAULT_FRONTEND_URL
    frontend_url = os.getenv("FRONTEND_URL", DEFAULT_FRONTEND_URL)
    
    bins_data = [
        {
            "id": b.id,
            "name": b.name,
            "tenant_id": b.tenant_id,
            "zone": b.zone,
            "latitude": b.latitude,
            "longitude": b.longitude
        }
        for b in bins
    ]
    
    zip_bytes = generate_all_labels_zip(bins_data, frontend_url=frontend_url)
    headers = {
        "Content-Disposition": 'attachment; filename="greenroute_smart_bin_labels_all.zip"'
    }
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)

