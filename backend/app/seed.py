"""
GreenRoute Database Seeding Script
Initializes SQLite database with multi-tenant campuses, smart bins, demo accounts,
and ESG baseline benchmarks.
All demo accounts are secured with bcrypt hashed passwords.
"""

from .database import engine, SessionLocal, Base
from . import models
from .auth_utils import hash_password

def seed_database():
    # Recreate tables to ensure schema matches current models
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Multi-Tenant Enterprise Organizations
        tenants = [
            models.Tenant(
                id="sou",
                name="Silver Oak University",
                facility_type="University",
                city="Ahmedabad",
                center_lat=23.0835,
                center_lng=72.5458,
                total_area_sqm=120000,
                contract_start="2026-01-01",
                esg_target_reduction_pct=35
            ),
            models.Tenant(
                id="tech_hub",
                name="Ahmedabad Tech Hub",
                facility_type="Corporate Tech Park",
                city="Ahmedabad",
                center_lat=23.0415,
                center_lng=72.5075,
                total_area_sqm=250000,
                contract_start="2026-02-15",
                esg_target_reduction_pct=40
            ),
            models.Tenant(
                id="metro_med",
                name="Metro Health City",
                facility_type="Hospital",
                city="Ahmedabad",
                center_lat=23.0532,
                center_lng=72.5938,
                total_area_sqm=180000,
                contract_start="2026-03-01",
                esg_target_reduction_pct=45
            )
        ]
        db.add_all(tenants)
        db.commit()

        # 2. Smart Campus Bins (Organized by Tenant)
        bins = [
            # --- Silver Oak University (sou) Campus Bins (1 - 8) ---
            models.Bin(
                id=1,
                tenant_id="sou",
                name="Campus Central Cafeteria",
                zone="cafeteria",
                priority_zone=True,
                latitude=23.0841,
                longitude=72.5448,
                fill_level=92,
                is_full=True,
                capacity=360,
                last_emptied="2026-09-14 07:30"
            ),
            models.Bin(
                id=2,
                tenant_id="sou",
                name="Administrative Block",
                zone="academic",
                priority_zone=False,
                latitude=23.0825,
                longitude=72.5455,
                fill_level=45,
                is_full=False,
                capacity=240,
                last_emptied="2026-09-14 08:15"
            ),
            models.Bin(
                id=3,
                tenant_id="sou",
                name="Central Library Hub",
                zone="academic",
                priority_zone=False,
                latitude=23.0838,
                longitude=72.5472,
                fill_level=88,
                is_full=True,
                capacity=240,
                last_emptied="2026-09-13 18:00"
            ),
            models.Bin(
                id=4,
                tenant_id="sou",
                name="Sports Complex & Gym",
                zone="academic",
                priority_zone=False,
                latitude=23.0815,
                longitude=72.5435,
                fill_level=20,
                is_full=False,
                capacity=180,
                last_emptied="2026-09-14 06:45"
            ),
            models.Bin(
                id=5,
                tenant_id="sou",
                name="Student Hostel Block A",
                zone="residential",
                priority_zone=False,
                latitude=23.0855,
                longitude=72.5462,
                fill_level=75,
                is_full=False,
                capacity=240,
                last_emptied="2026-09-13 21:00"
            ),
            models.Bin(
                id=6,
                tenant_id="sou",
                name="Student Hostel Block B",
                zone="residential",
                priority_zone=False,
                latitude=23.0852,
                longitude=72.5480,
                fill_level=82,
                is_full=True,
                capacity=240,
                last_emptied="2026-09-13 21:15"
            ),
            models.Bin(
                id=7,
                tenant_id="sou",
                name="Mechanical Engineering Workshop",
                zone="academic",
                priority_zone=False,
                latitude=23.0818,
                longitude=72.5485,
                fill_level=30,
                is_full=False,
                capacity=360,
                last_emptied="2026-09-14 09:00"
            ),
            models.Bin(
                id=8,
                tenant_id="sou",
                name="Biotechnology Research Wing",
                zone="hospital",
                priority_zone=True,
                latitude=23.0830,
                longitude=72.5492,
                fill_level=85,
                is_full=True,
                capacity=240,
                last_emptied="2026-09-13 19:30"
            ),

            # --- Ahmedabad Tech Hub (tech_hub) Bins (9 - 14) ---
            models.Bin(
                id=9,
                tenant_id="tech_hub",
                name="Innovation Tower Alpha",
                zone="tech_park",
                priority_zone=True,
                latitude=23.0422,
                longitude=72.5065,
                fill_level=88,
                is_full=True,
                capacity=360,
                last_emptied="2026-09-14 08:00"
            ),
            models.Bin(
                id=10,
                tenant_id="tech_hub",
                name="Cloud Data Center & Server Farm",
                zone="tech_park",
                priority_zone=False,
                latitude=23.0408,
                longitude=72.5082,
                fill_level=35,
                is_full=False,
                capacity=240,
                last_emptied="2026-09-14 06:30"
            ),
            models.Bin(
                id=11,
                tenant_id="tech_hub",
                name="Central Food Plaza & Cafeteria",
                zone="cafeteria",
                priority_zone=True,
                latitude=23.0430,
                longitude=72.5088,
                fill_level=95,
                is_full=True,
                capacity=400,
                last_emptied="2026-09-14 07:15"
            ),
            models.Bin(
                id=12,
                tenant_id="tech_hub",
                name="Robotics & Hardware R&D Lab",
                zone="tech_park",
                priority_zone=False,
                latitude=23.0398,
                longitude=72.5059,
                fill_level=78,
                is_full=False,
                capacity=240,
                last_emptied="2026-09-13 20:00"
            ),
            models.Bin(
                id=13,
                tenant_id="tech_hub",
                name="Executive Conference Atrium",
                zone="academic",
                priority_zone=False,
                latitude=23.0428,
                longitude=72.5048,
                fill_level=25,
                is_full=False,
                capacity=180,
                last_emptied="2026-09-14 09:30"
            ),
            models.Bin(
                id=14,
                tenant_id="tech_hub",
                name="EV Charging & Solar Canopy",
                zone="residential",
                priority_zone=False,
                latitude=23.0441,
                longitude=72.5072,
                fill_level=82,
                is_full=True,
                capacity=240,
                last_emptied="2026-09-13 22:00"
            ),

            # --- Metro Health City (metro_med) Bins (15 - 20) ---
            models.Bin(
                id=15,
                tenant_id="metro_med",
                name="Emergency Trauma Center",
                zone="hospital",
                priority_zone=True,
                latitude=23.0542,
                longitude=72.5925,
                fill_level=94,
                is_full=True,
                capacity=360,
                last_emptied="2026-09-14 08:30"
            ),
            models.Bin(
                id=16,
                tenant_id="metro_med",
                name="Outpatient Department (OPD) Block",
                zone="hospital",
                priority_zone=True,
                latitude=23.0525,
                longitude=72.5948,
                fill_level=86,
                is_full=True,
                capacity=360,
                last_emptied="2026-09-14 07:45"
            ),
            models.Bin(
                id=17,
                tenant_id="metro_med",
                name="Super-Specialty Surgical Wing",
                zone="hospital",
                priority_zone=False,
                latitude=23.0550,
                longitude=72.5912,
                fill_level=60,
                is_full=False,
                capacity=240,
                last_emptied="2026-09-14 06:00"
            ),
            models.Bin(
                id=18,
                tenant_id="metro_med",
                name="Central Pathology & Diagnostic Lab",
                zone="hospital",
                priority_zone=False,
                latitude=23.0518,
                longitude=72.5955,
                fill_level=70,
                is_full=False,
                capacity=240,
                last_emptied="2026-09-13 23:00"
            ),
            models.Bin(
                id=19,
                tenant_id="metro_med",
                name="Medical College Lecture Halls",
                zone="academic",
                priority_zone=False,
                latitude=23.0505,
                longitude=72.5932,
                fill_level=40,
                is_full=False,
                capacity=180,
                last_emptied="2026-09-14 09:15"
            ),
            models.Bin(
                id=20,
                tenant_id="metro_med",
                name="24/7 Central Pharmacy Hub",
                zone="hospital",
                priority_zone=True,
                latitude=23.0538,
                longitude=72.5960,
                fill_level=91,
                is_full=True,
                capacity=240,
                last_emptied="2026-09-14 08:00"
            )
        ]
        db.add_all(bins)
        db.commit()

        # 3. Seed Users across Campuses with Bcrypt Hashed Passwords
        default_pwd = hash_password("password123")

        users = [
            # SOU Demo Users
            models.User(
                id=1,
                tenant_id="sou",
                name="Kushal Bhatt",
                email="kushal@sou.edu.in",
                hashed_password=default_pwd,
                role="citizen",
                is_approved=True,
                points=953,
                rank="Nature Knight",
                streak=4,
                total_scans=18,
                last_scan_date="2026-09-14"
            ),
            models.User(
                id=2,
                tenant_id="sou",
                name="Director Sharma",
                email="head.authority@sou.edu.in",
                hashed_password=default_pwd,
                role="head_admin",
                is_approved=True,
                admin_id="DIR-EXEC-01",
                department="Executive Office",
                points=0,
                rank="Head Authority",
                streak=0,
                total_scans=0
            ),
            models.User(
                id=3,
                tenant_id="sou",
                name="Vikram Mehta",
                email="facilities.lead@sou.edu.in",
                hashed_password=default_pwd,
                role="admin",
                is_approved=True,
                admin_id="ADM-SOU-02",
                department="Campus Operations",
                points=120,
                rank="Eco Scout",
                streak=2,
                total_scans=5
            ),
            models.User(
                id=4,
                tenant_id="sou",
                name="Ramesh Kumar",
                email="driver.ramesh@sou.edu.in",
                hashed_password=default_pwd,
                role="driver",
                is_approved=True,
                admin_id="DRV-01",
                department="Fleet Logistics",
                points=0,
                rank="Fleet Captain",
                streak=0,
                total_scans=0
            ),

            # SOU Leaderboard Citizens
            models.User(
                id=5,
                tenant_id="sou",
                name="Rahul D.",
                email="rahul.d@sou.edu.in",
                hashed_password=default_pwd,
                role="citizen",
                is_approved=True,
                points=2850,
                rank="Gaia Master",
                streak=15,
                total_scans=54,
                last_scan_date="2026-09-14"
            ),
            models.User(
                id=6,
                tenant_id="sou",
                name="Sneha P.",
                email="sneha.p@sou.edu.in",
                hashed_password=default_pwd,
                role="citizen",
                is_approved=True,
                points=1920,
                rank="Planet Guardian",
                streak=11,
                total_scans=39,
                last_scan_date="2026-09-13"
            ),
            models.User(
                id=7,
                tenant_id="sou",
                name="Amit K.",
                email="amit.k@sou.edu.in",
                hashed_password=default_pwd,
                role="citizen",
                is_approved=True,
                points=1410,
                rank="Nature Knight",
                streak=8,
                total_scans=28,
                last_scan_date="2026-09-14"
            ),
            models.User(
                id=8,
                tenant_id="sou",
                name="Tanvi S.",
                email="tanvi.s@sou.edu.in",
                hashed_password=default_pwd,
                role="citizen",
                is_approved=True,
                points=890,
                rank="Green Champion",
                streak=5,
                total_scans=17,
                last_scan_date="2026-09-12"
            ),

            # Tech Hub Users
            models.User(
                id=9,
                tenant_id="tech_hub",
                name="Pooja Verma",
                email="admin@techhub.io",
                hashed_password=default_pwd,
                role="admin",
                is_approved=True,
                admin_id="ADM-TH-01",
                department="Tech Park Facilities",
                points=250,
                rank="Eco Scout",
                streak=3,
                total_scans=8
            ),
            models.User(
                id=10,
                tenant_id="tech_hub",
                name="Arjun Rao",
                email="developer@techhub.io",
                hashed_password=default_pwd,
                role="citizen",
                is_approved=True,
                points=620,
                rank="Green Champion",
                streak=6,
                total_scans=12,
                last_scan_date="2026-09-14"
            ),

            # Metro Med Users
            models.User(
                id=11,
                tenant_id="metro_med",
                name="Dr. Ananya Sen",
                email="admin@metromed.org",
                hashed_password=default_pwd,
                role="admin",
                is_approved=True,
                admin_id="ADM-MM-01",
                department="Hospital Hygiene Directorate",
                points=310,
                rank="Eco Scout",
                streak=4,
                total_scans=10
            ),
            models.User(
                id=12,
                tenant_id="metro_med",
                name="Riya Patel",
                email="nurse.riya@metromed.org",
                hashed_password=default_pwd,
                role="citizen",
                is_approved=True,
                points=480,
                rank="Eco Scout",
                streak=5,
                total_scans=9,
                last_scan_date="2026-09-14"
            )
        ]
        db.add_all(users)
        db.commit()

        # 4. Audit Log Entries
        audit_entries = [
            models.AuditLog(
                tenant_id="sou",
                name="Vikram Mehta",
                emp_id="ADM-SOU-02",
                email="facilities.lead@sou.edu.in",
                department="Campus Operations",
                action="APPROVED",
                timestamp="2026-09-10 10:30:00"
            ),
            models.AuditLog(
                tenant_id="sou",
                name="Test Logistics Lead",
                emp_id="LOG-004",
                email="test.logistics@sou.edu.in",
                department="Logistics",
                action="REJECTED",
                timestamp="2026-09-11 14:15:00"
            ),
            models.AuditLog(
                tenant_id="tech_hub",
                name="Pooja Verma",
                emp_id="ADM-TH-01",
                email="admin@techhub.io",
                department="Tech Park Facilities",
                action="APPROVED",
                timestamp="2026-09-12 11:00:00"
            ),
            models.AuditLog(
                tenant_id="metro_med",
                name="Dr. Ananya Sen",
                emp_id="ADM-MM-01",
                email="admin@metromed.org",
                department="Hospital Hygiene Directorate",
                action="APPROVED",
                timestamp="2026-09-13 09:45:00"
            )
        ]
        db.add_all(audit_entries)
        db.commit()

        print("Successfully seeded multi-tenant GreenRoute database with 3 campuses, 20 smart bins, and demo accounts!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
