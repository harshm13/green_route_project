from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
import math
from .. import models, services
from ..database import SessionLocal
from ..auth_utils import hash_password, verify_password, create_access_token, require_auth

router = APIRouter(
    prefix="/users",
    tags=["Users & Authentication"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- PYDANTIC SCHEMAS ---
class UserCreate(BaseModel):
    name: str
    email: str
    password: str = "password123"
    role: Optional[str] = "citizen"
    tenant_id: Optional[str] = "sou"
    admin_id: Optional[str] = None
    department: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: Optional[str] = None
    role: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    tenant_id: str = "sou"
    name: str
    email: str
    role: str = "citizen"
    is_approved: bool = True
    admin_id: Optional[str] = None
    department: Optional[str] = None
    points: int = 0
    rank: str = "Novice Sprout"
    streak: int = 0
    total_scans: int = 0

    class Config:
        from_attributes = True

class UserLoginResponse(UserResponse):
    access_token: str
    token_type: str = "bearer"

class ScanResult(BaseModel):
    status: str
    message: str
    earned_points: int
    previous_points: int
    new_total_points: int
    multiplier: float
    waste_type: str
    current_streak: int
    new_rank: str
    user: UserResponse
    geofence: Optional[Dict[str, Any]] = None

# --- API ENDPOINTS ---

# 1. Register a new user (Citizen or Admin)
@router.post("/", response_model=UserLoginResponse)
@router.post("/register", response_model=UserLoginResponse)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    email_clean = user_data.email.strip().lower()
    existing_user = db.query(models.User).filter(models.User.email == email_clean).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    is_admin = user_data.role in ["admin", "head_admin"]
    is_approved = not (user_data.role == "admin") # Admins require Head Admin approval

    # Cryptographically hash the password
    hashed_pwd = hash_password(user_data.password or "password123")

    db_user = models.User(
        name=user_data.name.strip(),
        email=email_clean,
        hashed_password=hashed_pwd,
        role=user_data.role or "citizen",
        is_approved=is_approved,
        admin_id=user_data.admin_id,
        department=user_data.department or ("Campus Facilities" if is_admin else None),
        points=0,
        rank="Novice Sprout",
        streak=1,
        total_scans=0,
        last_scan_date=datetime.now().strftime("%Y-%m-%d")
    )
    db.add(db_user)
    db.flush()

    # If new admin, queue into AdminApproval table
    if user_data.role == "admin":
        approval = models.AdminApproval(
            name=db_user.name,
            emp_id=db_user.admin_id or f"ADM-{db_user.id}",
            email=db_user.email,
            department=db_user.department or "Campus Facilities",
            date=datetime.now().strftime("%Y-%m-%d"),
            status="PENDING"
        )
        db.add(approval)

    db.commit()
    db.refresh(db_user)

    token = create_access_token({
        "sub": str(db_user.id),
        "email": db_user.email,
        "role": db_user.role
    })

    return UserLoginResponse(
        id=db_user.id,
        name=db_user.name,
        email=db_user.email,
        role=db_user.role,
        is_approved=db_user.is_approved,
        admin_id=db_user.admin_id,
        department=db_user.department,
        points=db_user.points,
        rank=db_user.rank,
        streak=db_user.streak,
        total_scans=db_user.total_scans,
        access_token=token,
        token_type="bearer"
    )

# 2. Login verification with Password & JWT generation
@router.post("/login", response_model=UserLoginResponse)
def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    email_clean = login_data.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email_clean).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found. Please register."
        )

    # Enforce password authentication
    if not login_data.password or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Incorrect password provided."
        )

    # Check admin approval status
    if user.role == "admin" and not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Your administrator account is still pending Head Authority approval."
        )

    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role
    })

    return UserLoginResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        is_approved=user.is_approved,
        admin_id=user.admin_id,
        department=user.department,
        points=user.points,
        rank=user.rank,
        streak=user.streak,
        total_scans=user.total_scans,
        access_token=token,
        token_type="bearer"
    )

# 3. Get Authenticated User Profile
@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: models.User = Depends(require_auth)):
    return current_user

# 4. Get the Global Leaderboard
@router.get("/leaderboard", response_model=List[UserResponse])
def get_leaderboard(limit: int = 10, db: Session = Depends(get_db)):
    users = db.query(models.User).filter(models.User.role == "citizen").order_by(models.User.points.desc()).limit(limit).all()
    return users

# 5. Get a specific user's profile
@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 1)

# 6. Gamified QR Code scan to earn points and update streaks (with optional Geofence)
@router.post("/{user_id}/scan", response_model=ScanResult)
def scan_bin(
    user_id: int,
    waste_type: str = Query("general", description="Material type: plastic, e-waste, organic, general"),
    bin_id: Optional[int] = Query(None, description="Smart bin ID scanned"),
    user_lat: Optional[float] = Query(None, description="Citizen GPS latitude"),
    user_lng: Optional[float] = Query(None, description="Citizen GPS longitude"),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    previous_points = user.points
    base_points = 50

    # Geofence anti-fraud verification
    geofence_bonus = 0
    geofence_verified = False
    geofence_status = "UNVERIFIED"
    distance_meters = None

    if bin_id is not None and user_lat is not None and user_lng is not None:
        target_bin = db.query(models.Bin).filter(models.Bin.id == bin_id).first()
        if target_bin:
            distance_meters = haversine_m(user_lat, user_lng, target_bin.latitude, target_bin.longitude)
            if distance_meters <= 50.0:
                geofence_verified = True
                geofence_status = "VERIFIED_ON_SITE"
                geofence_bonus = 15
            elif distance_meters > 200.0:
                geofence_status = "SPOOF_FLAGGED"
            else:
                geofence_status = "PROXIMITY_NORMAL"

    # Calculate streak logic
    last_scan_dt = None
    if user.last_scan_date:
        try:
            last_scan_dt = datetime.strptime(user.last_scan_date, "%Y-%m-%d")
        except Exception:
            pass
    
    new_streak = services.update_streak(last_scan_dt, user.streak)
    user.streak = new_streak

    # Points calculation with multipliers from services.py + geofence bonus
    earned_points = services.calculate_earned_points(base_points=base_points, current_streak=new_streak, waste_type=waste_type) + geofence_bonus
    
    user.points += earned_points
    user.total_scans = (user.total_scans or 0) + 1
    user.last_scan_date = datetime.now().strftime("%Y-%m-%d")
    user.rank = services.calculate_rank(user.points)

    db.commit()
    db.refresh(user)

    multiplier = round(earned_points / base_points, 2)
    message = f"Awesome! You segregated {waste_type.upper()} and earned {earned_points} Green Points!"
    if geofence_verified:
        message += " [Verified On-Site 📍 +15 bonus]"

    return {
        "status": "success",
        "message": message,
        "earned_points": earned_points,
        "previous_points": previous_points,
        "new_total_points": user.points,
        "multiplier": multiplier,
        "waste_type": waste_type,
        "current_streak": user.streak,
        "new_rank": user.rank,
        "user": user,
        "geofence": {
            "status": geofence_status,
            "verified": geofence_verified,
            "distance_meters": distance_meters,
            "bonus_points": geofence_bonus
        }
    }