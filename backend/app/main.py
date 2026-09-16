from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models
from .database import engine, SessionLocal
from .routers import users, bins, routing, approvals, ai
from .seed import seed_database

# Ensure database tables exist
models.Base.metadata.create_all(bind=engine)

# Auto-seed if database is empty
def auto_seed_if_needed():
    db = SessionLocal()
    try:
        bin_count = db.query(models.Bin).count()
        if bin_count == 0:
            print("Auto-seeding initial GreenRoute database...")
            seed_database()
    except Exception as e:
        print(f"Startup check error: {e}")
    finally:
        db.close()

auto_seed_if_needed()

app = FastAPI(title="Green Route API", version="1.0", description="Smart Waste Management & Dynamic Routing API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# Plug in all routers
app.include_router(users.router)
app.include_router(bins.router)
app.include_router(routing.router)
app.include_router(approvals.router)
app.include_router(ai.router)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"status": "success", "message": "The Green Route Backend is officially running! 🌍"}

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    bin_count = db.query(models.Bin).count()
    user_count = db.query(models.User).count()
    pending_approvals = db.query(models.AdminApproval).filter(models.AdminApproval.status == "PENDING").count()
    critical_bins = db.query(models.Bin).filter(models.Bin.fill_level >= 80).count()

    return {
        "status": "healthy",
        "backend": "FastAPI",
        "database": "SQLite (green_route.db)",
        "stats": {
            "total_bins": bin_count,
            "critical_bins": critical_bins,
            "total_users": user_count,
            "pending_approvals": pending_approvals
        }
    }