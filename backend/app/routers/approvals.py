from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from .. import models
from ..database import SessionLocal
from ..auth_utils import require_role

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
    tenant_id: Optional[str] = "sou"
    department: Optional[str] = "Campus Facilities"

# --- API ENDPOINTS ---

# 1. Fetch all pending admin requests (Tenant-isolated, Admin / Head Admin only)
@router.get("/approvals", response_model=List[ApprovalResponse])
def get_pending_approvals(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role(["admin", "head_admin"]))
):
    query = db.query(models.AdminApproval).filter(models.AdminApproval.status == "PENDING")
    if current_admin.tenant_id and current_admin.tenant_id != "all":
        query = query.filter(models.AdminApproval.tenant_id == current_admin.tenant_id)
    return query.all()

# 2. Approve admin request (Head Admin only, with tenant boundary & valid transition checks)
@router.post("/approvals/{approval_id}/approve", response_model=ApprovalResponse)
def approve_admin(
    approval_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role(["head_admin"]))
):
    approval = db.query(models.AdminApproval).filter(models.AdminApproval.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")

    # Enforce tenant boundary
    if current_admin.tenant_id and approval.tenant_id != current_admin.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tenant boundary violation: Cannot approve admin for organization '{approval.tenant_id}'."
        )

    # Enforce valid approval state transitions
    if approval.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid approval transition: Request is already '{approval.status}'. Only PENDING requests can be approved."
        )

    approval.status = "APPROVED"

    # Update corresponding user account if exists
    user = db.query(models.User).filter(models.User.email == approval.email).first()
    if user:
        user.is_approved = True

    # Record in AuditLog with tenant isolation
    audit_entry = models.AuditLog(
        tenant_id=approval.tenant_id,
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

# 3. Reject admin request (Head Admin only, with tenant boundary & valid transition checks)
@router.post("/approvals/{approval_id}/reject", response_model=ApprovalResponse)
def reject_admin(
    approval_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role(["head_admin"]))
):
    approval = db.query(models.AdminApproval).filter(models.AdminApproval.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")

    # Enforce tenant boundary
    if current_admin.tenant_id and approval.tenant_id != current_admin.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tenant boundary violation: Cannot reject admin for organization '{approval.tenant_id}'."
        )

    # Enforce valid approval state transitions
    if approval.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid approval transition: Request is already '{approval.status}'. Only PENDING requests can be rejected."
        )

    approval.status = "REJECTED"

    user = db.query(models.User).filter(models.User.email == approval.email).first()
    if user:
        user.is_approved = False

    audit_entry = models.AuditLog(
        tenant_id=approval.tenant_id,
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

# 4. Fetch Access Governance Audit Log (Tenant-isolated, Admin / Head Admin only)
@router.get("/audit-log", response_model=List[AuditLogResponse])
def get_audit_log(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role(["admin", "head_admin"]))
):
    query = db.query(models.AuditLog)
    if current_admin.tenant_id and current_admin.tenant_id != "all":
        query = query.filter(models.AuditLog.tenant_id == current_admin.tenant_id)
    return query.order_by(models.AuditLog.id.desc()).all()

# 5. Inject a simulated pending request (useful for testing and demoing)
@router.post("/approvals/seed-request", response_model=ApprovalResponse)
def seed_pending_request(data: SeedRequest, db: Session = Depends(get_db)):
    new_req = models.AdminApproval(
        tenant_id=data.tenant_id or "sou",
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
