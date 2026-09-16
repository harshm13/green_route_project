from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from .. import models, services
from ..database import SessionLocal

router = APIRouter(
    prefix="/users",
    tags=["Users"]
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
    password: Optional[str] = "greenroute123"
    role: Optional[str] = "citizen"
    admin_id: Optional[str] = None
    department: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: Optional[str] = None
    role: Optional[str] = None

class UserResponse(BaseModel):
    id: int
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

# --- API ENDPOINTS ---

# 1. Register a new user (Citizen or Admin)
@router.post("/", response_model=UserResponse)
@router.post("/register", response_model=UserResponse)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    email_clean = user_data.email.strip().lower()
    existing_user = db.query(models.User).filter(models.User.email == email_clean).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    is_admin = user_data.role in ["admin", "head_admin"]
    is_approved = not (user_data.role == "admin") # Admins require Head Admin approval

    db_user = models.User(
        name=user_data.name.strip(),
        email=email_clean,
        password=user_data.password or "greenroute123",
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
    return db_user

# 2. Login verification
@router.post("/login", response_model=UserResponse)
def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    email_clean = login_data.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email_clean).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found. Please register.")
    
    return user

# 3. Get the Global Leaderboard
@router.get("/leaderboard", response_model=List[UserResponse])
def get_leaderboard(limit: int = 10, db: Session = Depends(get_db)):
    users = db.query(models.User).filter(models.User.role == "citizen").order_by(models.User.points.desc()).limit(limit).all()
    return users

# 4. Get a specific user's profile
@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# 5. Gamified QR Code scan to earn points and update streaks
@router.post("/{user_id}/scan", response_model=ScanResult)
def scan_bin(
    user_id: int,
    waste_type: str = Query("general", description="Material type: plastic, e-waste, organic, general"),
    bin_id: Optional[int] = Query(None, description="Smart bin ID scanned"),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    previous_points = user.points
    base_points = 50

    # Calculate streak logic
    last_scan_dt = None
    if user.last_scan_date:
        try:
            last_scan_dt = datetime.strptime(user.last_scan_date, "%Y-%m-%d")
        except Exception:
            pass
    
    new_streak = services.update_streak(last_scan_dt, user.streak)
    user.streak = new_streak

    # Points calculation with multipliers from services.py
    earned_points = services.calculate_earned_points(base_points=base_points, current_streak=new_streak, waste_type=waste_type)
    
    user.points += earned_points
    user.total_scans = (user.total_scans or 0) + 1
    user.last_scan_date = datetime.now().strftime("%Y-%m-%d")
    user.rank = services.calculate_rank(user.points)

    db.commit()
    db.refresh(user)

    multiplier = round(earned_points / base_points, 2)
    return {
        "status": "success",
        "message": f"Awesome! You segregated {waste_type.upper()} and earned {earned_points} Green Points!",
        "earned_points": earned_points,
        "previous_points": previous_points,
        "new_total_points": user.points,
        "multiplier": multiplier,
        "waste_type": waste_type,
        "current_streak": user.streak,
        "new_rank": user.rank,
        "user": user
    }