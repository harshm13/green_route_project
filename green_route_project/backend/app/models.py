from sqlalchemy import Column, Integer, String, Boolean, Float
from .database import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String, primary_key=True, index=True) # 'sou' | 'tech_hub' | 'metro_med'
    name = Column(String, nullable=False)
    facility_type = Column(String, default="University") # 'University' | 'Corporate Tech Park' | 'Hospital'
    city = Column(String, default="Ahmedabad")
    center_lat = Column(Float, default=23.0835)
    center_lng = Column(Float, default=72.5458)
    total_area_sqm = Column(Integer, default=120000)
    contract_start = Column(String, default="2026-01-01")
    esg_target_reduction_pct = Column(Integer, default=30)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, default="sou", index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="citizen") # 'citizen' | 'admin' | 'head_admin' | 'driver'
    is_approved = Column(Boolean, default=True) # False for pending admin accounts
    admin_id = Column(String, nullable=True)
    department = Column(String, nullable=True)
    
    # Gamification Stats
    points = Column(Integer, default=0)
    rank = Column(String, default="Novice Sprout")
    streak = Column(Integer, default=0)
    total_scans = Column(Integer, default=0)
    last_scan_date = Column(String, nullable=True)

class Bin(Base):
    __tablename__ = "bins"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, default="sou", index=True)
    name = Column(String, index=True)
    zone = Column(String, default="academic") # 'cafeteria' | 'hospital' | 'academic' | 'tech_park' | 'residential'
    priority_zone = Column(Boolean, default=False)
    
    latitude = Column(Float)
    longitude = Column(Float)
    
    fill_level = Column(Integer, default=50) # 0 to 100 percentage
    is_full = Column(Boolean, default=False)
    capacity = Column(Integer, default=240) # Liters
    last_emptied = Column(String, nullable=True)

    @property
    def lat(self) -> float:
        return self.latitude

    @property
    def lng(self) -> float:
        return self.longitude


class AdminApproval(Base):
    __tablename__ = "admin_approvals"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, default="sou", index=True)
    name = Column(String, nullable=False)
    emp_id = Column(String, nullable=False)
    email = Column(String, nullable=False)
    department = Column(String, default="Campus Facilities")
    date = Column(String, nullable=False)
    status = Column(String, default="PENDING") # 'PENDING' | 'APPROVED' | 'REJECTED'

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, default="sou", index=True)
    name = Column(String, nullable=False)
    emp_id = Column(String, nullable=False)
    email = Column(String, nullable=False)
    department = Column(String, default="Campus Facilities")
    action = Column(String, nullable=False) # 'APPROVED' | 'REJECTED'
    timestamp = Column(String, nullable=False)
