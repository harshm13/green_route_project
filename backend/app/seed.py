"""
GreenRoute Database Seeding Script
Initializes SQLite database with campus smart bins, demo accounts, and leaderboard data.
"""

from .database import engine, SessionLocal, Base
from . import models

def seed_database():
    # Recreate tables to ensure schema matches current models
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Seed Campus Bins
        campus_bins = [
            models.Bin(
                id=1,
                name="Campus Central Cafeteria",
                zone="cafeteria",
                priority_zone=True,
                latitude=23.0825,
                longitude=72.5455,
                fill_level=92,
                is_full=True,
                capacity=240,
                last_emptied="2026-09-13 09:15"
            ),
            models.Bin(
                id=2,
                name="Student Health Center (Clinic)",
                zone="hospital",
                priority_zone=True,
                latitude=23.0812,
                longitude=72.5438,
                fill_level=68,
                is_full=True, # Priority zone >= 60% is full
                capacity=120,
                last_emptied="2026-09-13 07:30"
            ),
            models.Bin(
                id=3,
                name="Central Library Hub",
                zone="academic",
                priority_zone=False,
                latitude=23.0838,
                longitude=72.5468,
                fill_level=35,
                is_full=False,
                capacity=180,
                last_emptied="2026-09-13 14:00"
            ),
            models.Bin(
                id=4,
                name="Engineering Block C",
                zone="academic",
                priority_zone=False,
                latitude=23.0855,
                longitude=72.5478,
                fill_level=86,
                is_full=True,
                capacity=240,
                last_emptied="2026-09-13 08:45"
            ),
            models.Bin(
                id=5,
                name="Innovation & Tech Park",
                zone="tech_park",
                priority_zone=False,
                latitude=23.0845,
                longitude=72.5420,
                fill_level=78,
                is_full=False,
                capacity=200,
                last_emptied="2026-09-13 11:20"
            ),
            models.Bin(
                id=6,
                name="Hostel Quad North",
                zone="residential",
                priority_zone=False,
                latitude=23.0870,
                longitude=72.5445,
                fill_level=95,
                is_full=True,
                capacity=360,
                last_emptied="2026-09-13 06:10"
            ),
            models.Bin(
                id=7,
                name="Sports Complex & Gym",
                zone="academic",
                priority_zone=False,
                latitude=23.0798,
                longitude=72.5485,
                fill_level=22,
                is_full=False,
                capacity=150,
                last_emptied="2026-09-13 15:30"
            ),
            models.Bin(
                id=8,
                name="Food Court East Plaza",
                zone="cafeteria",
                priority_zone=True,
                latitude=23.0805,
                longitude=72.5462,
                fill_level=84,
                is_full=True,
                capacity=240,
                last_emptied="2026-09-13 10:40"
            ),
        ]
        db.add_all(campus_bins)

        # 2. Seed Users
        users = [
            models.User(
                name="Kushal Bhatt",
                email="kushal@sou.edu.in",
                password="password123",
                role="citizen",
                points=500,
                rank="Eco Ranger",
                streak=3,
                total_scans=7,
                is_approved=True
            ),
            models.User(
                name="Vikram Mehta",
                email="facilities.lead@sou.edu.in",
                password="password123",
                role="admin",
                admin_id="ADM-2026-X1",
                department="Campus Facilities",
                points=0,
                rank="Facilities Admin",
                streak=0,
                total_scans=0,
                is_approved=True
            ),
            models.User(
                name="Director Sharma",
                email="head.authority@sou.edu.in",
                password="password123",
                role="head_admin",
                admin_id="HEAD-AUTH-01",
                department="Executive Office",
                points=0,
                rank="Head Authority",
                streak=0,
                total_scans=0,
                is_approved=True
            ),
            # Campus Leaderboard Users
            models.User(
                name="Rahul D.",
                email="rahul.d@sou.edu.in",
                password="password123",
                role="citizen",
                points=2850,
                rank="Gaia Master",
                streak=14,
                total_scans=42,
                is_approved=True
            ),
            models.User(
                name="Sneha P.",
                email="sneha.p@sou.edu.in",
                password="password123",
                role="citizen",
                points=1920,
                rank="Planet Guardian",
                streak=9,
                total_scans=28,
                is_approved=True
            ),
            models.User(
                name="Amit K.",
                email="amit.k@sou.edu.in",
                password="password123",
                role="citizen",
                points=1410,
                rank="Nature Knight",
                streak=6,
                total_scans=19,
                is_approved=True
            ),
            models.User(
                name="Tanvi S.",
                email="tanvi.s@sou.edu.in",
                password="password123",
                role="citizen",
                points=420,
                rank="Novice Sprout",
                streak=2,
                total_scans=5,
                is_approved=True
            ),
        ]
        db.add_all(users)

        # 3. Seed Admin Approvals
        approvals = [
            models.AdminApproval(
                id=1,
                name="Aarav Patel",
                emp_id="ADM-102",
                email="aarav.p@eco.gov",
                department="Sanitation Logistics",
                date="2026-09-13",
                status="PENDING"
            ),
            models.AdminApproval(
                id=2,
                name="Priya Sharma",
                emp_id="ADM-105",
                email="priya.s@eco.gov",
                department="Fleet Operations",
                date="2026-09-13",
                status="PENDING"
            )
        ]
        db.add_all(approvals)

        # 4. Seed Audit Log sample
        audit_records = [
            models.AuditLog(
                id=1,
                name="Rohit Verma",
                emp_id="ADM-099",
                email="rohit.v@eco.gov",
                department="Waste Logistics",
                action="APPROVED",
                timestamp="2026-09-12 11:30"
            )
        ]
        db.add_all(audit_records)

        db.commit()
        print("Database successfully seeded with campus smart bins, users, and approvals! 🌱")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
