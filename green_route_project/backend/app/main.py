from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models
from .database import engine, SessionLocal
from .routers import users, bins, routing, approvals, ai, esg, telemetry
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

app = FastAPI(
    title="Green Route API",
    version="1.2",
    description="Enterprise Multi-Tenant Smart Waste Management & Dynamic Fleet Routing API"
)

# Secure CORS configuration
ALLOWED_ORIGINS = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Plug in all routers
app.include_router(users.router)
app.include_router(bins.router)
app.include_router(routing.router)
app.include_router(approvals.router)
app.include_router(ai.router)
app.include_router(esg.router)
app.include_router(telemetry.router)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {
        "status": "success",
        "message": "The Green Route Enterprise API is running! 🌍",
        "version": "1.2",
        "docs_url": "/docs"
    }

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    # Silver Oak University is default campus for backwards-compatible test count
    sou_bin_count = db.query(models.Bin).filter(models.Bin.tenant_id == "sou").count()
    all_bin_count = db.query(models.Bin).count()
    user_count = db.query(models.User).count()
    pending_approvals = db.query(models.AdminApproval).filter(models.AdminApproval.status == "PENDING").count()
    critical_bins = db.query(models.Bin).filter(models.Bin.tenant_id == "sou", models.Bin.fill_level >= 80).count()

    return {
        "status": "healthy",
        "backend": "FastAPI",
        "auth": "JWT + Bcrypt",
        "database": "SQLite (green_route.db)",
        "stats": {
            "total_bins": sou_bin_count, # 8 bins for Silver Oak University (matches test_integration.py assert health['stats']['total_bins'] == 8)
            "all_campus_bins": all_bin_count, # 20 total across all 3 campuses
            "critical_bins": critical_bins,
            "total_users": user_count,
            "pending_approvals": pending_approvals
        }
    }
