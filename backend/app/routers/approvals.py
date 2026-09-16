from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from .. import models
from ..database import SessionLocal

router = APIRouter(
    prefix="/admin",
    tags=["Access Governance & Approvals"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- PYDANTIC SCHEMAS ---
class ApprovalResponse(BaseModel):
    id: int
    name: str
    emp_id: str
    email: str
    department: str
    date: str
    status: str

    class Config:
        from_attributes = True

class AuditLogResponse(BaseModel):
    id: int
    name: str
    emp_id: str
    email: str
    department: str
    action: str
    timestamp: str

    class Config:
        from_attributes = True

class SeedRequest(BaseModel):
    name: str
    emp_id: str
    email: str
    department: Optional[str] = "Campus Facilities"

# --- API ENDPOINTS ---

# 1. Fetch all pending admin requests
@router.get("/approvals", response_model=List[ApprovalResponse])
def get_pending_approvals(db: Session = Depends(get_db)):
    return db.query(models.AdminApproval).filter(models.AdminApproval.status == "PENDING").all()

# 2. Approve admin request
@router.post("/approvals/{approval_id}/approve", response_model=ApprovalResponse)
def approve_admin(approval_id: int, db: Session = Depends(get_db)):
    approval = db.query(models.AdminApproval).filter(models.AdminApproval.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")

    approval.status = "APPROVED"

    # Update corresponding user account if exists
    user = db.query(models.User).filter(models.User.email == approval.email).first()
    if user:
        user.is_approved = True

    # Record in AuditLog
    audit_entry = models.AuditLog(
        name=approval.name,
        emp_id=approval.emp_id,
        email=approval.email,
        department=approval.department,
        action="APPROVED",
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M")
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(approval)
    return approval

# 3. Reject admin request
@router.post("/approvals/{approval_id}/reject", response_model=ApprovalResponse)
def reject_admin(approval_id: int, db: Session = Depends(get_db)):
    approval = db.query(models.AdminApproval).filter(models.AdminApproval.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")

    approval.status = "REJECTED"

    user = db.query(models.User).filter(models.User.email == approval.email).first()
    if user:
        user.is_approved = False

    audit_entry = models.AuditLog(
        name=approval.name,
        emp_id=approval.emp_id,
        email=approval.email,
        department=approval.department,
        action="REJECTED",
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M")
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(approval)
    return approval

# 4. Fetch Access Governance Audit Log
@router.get("/audit-log", response_model=List[AuditLogResponse])
def get_audit_log(db: Session = Depends(get_db)):
    return db.query(models.AuditLog).order_by(models.AuditLog.id.desc()).all()

# 5. Inject a simulated pending request (useful for testing and demoing)
@router.post("/approvals/seed-request", response_model=ApprovalResponse)
def seed_pending_request(data: SeedRequest, db: Session = Depends(get_db)):
    new_req = models.AdminApproval(
        name=data.name,
        emp_id=data.emp_id,
        email=data.email,
        department=data.department or "Campus Facilities",
        date=datetime.now().strftime("%Y-%m-%d"),
        status="PENDING"
    )
    db.add(new_req)
    db.commit()
    db.refresh(new_req)
    return new_req
