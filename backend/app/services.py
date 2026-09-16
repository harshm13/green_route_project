from datetime import datetime, timedelta
# Note: You will need to import your database models here once they are ready!
# from app.models import User, Bin

# --- 1. QR Validation Logic ---
def validate_qr_scan(scanned_bin_id: str, valid_bin_ids: list) -> bool:
    """
    Checks if the scanned QR code matches a valid, registered smart bin.
    """
    if not scanned_bin_id:
        return False
        
    # In a real scenario, you'd query the DB to check if the bin exists and is active
    if scanned_bin_id in valid_bin_ids:
        return True
    return False

# --- 2. Streak Condition Logic ---
def update_streak(last_scan_date: datetime, current_streak: int) -> int:
    """
    Checks the time since the last scan. 
    - If scanned yesterday, increment streak.
    - If scanned today, streak stays the same (already counted for the day).
    - If missed a day, reset streak to 1.
    """
    if not last_scan_date:
        return 1 # First time scanning!

    today = datetime.now().date()
    last_scan = last_scan_date.date()
    delta_days = (today - last_scan).days

    if delta_days == 1:
        return current_streak + 1 # Streak continues!
    elif delta_days == 0:
        return current_streak # Already scanned today, keep current streak
    else:
        return 1 # Streak broken, back to 1

# --- 3. Point Calculation & Multipliers ---
def calculate_earned_points(base_points: int, current_streak: int, waste_type: str = "general") -> int:
    """
    Calculates final points based on the base points, the user's current streak, 
    and the type of waste being recycled.
    """
    multiplier = 1.0
    
    # 1. Streak Multipliers
    if current_streak >= 7:
        multiplier += 0.5  # +50% points for a 7-day streak!
    elif current_streak >= 3:
        multiplier += 0.2  # +20% points for a 3-day streak!
        
    # 2. Bonus for specific waste types (e-waste is harder to recycle!)
    if waste_type.lower() == "e-waste":
        multiplier += 0.5
    elif waste_type.lower() == "plastic":
        multiplier += 0.1

    final_points = int(base_points * multiplier)
    return final_points

# --- 4. THE MAIN ENGINE PROCESS ---
def process_user_scan(db_session, user_id: int, scanned_bin_id: str, waste_type: str = "general"):
    """
    This is the main function your API Router will call. It brings all the logic together.
    """
    # 1. Fetch User from DB (Pseudocode)
    # user = db_session.query(User).filter(User.id == user_id).first()
    # if not user: raise Exception("User not found")
    
    # Let's pretend we fetched this data from your user model:
    mock_user_last_scan = datetime.now() - timedelta(days=1)
    mock_user_streak = 2
    mock_user_points = 500
    valid_bins = ["BIN_BLOCK_C", "BIN_LIBRARY"]

    # 2. Validate the Scan
    if not validate_qr_scan(scanned_bin_id, valid_bins):
        return {"status": "error", "message": "Invalid QR Code or Bin ID."}

    # 3. Calculate new streak
    new_streak = update_streak(mock_user_last_scan, mock_user_streak)

    # 4. Calculate points (Base 50 points per scan)
    earned_points = calculate_earned_points(base_points=50, current_streak=new_streak, waste_type=waste_type)

    # 5. Save to Database (Pseudocode)
    # user.points += earned_points
    # user.streak = new_streak
    # user.last_scan_date = datetime.now()
    # db_session.commit()

    return {
        "status": "success",
        "message": f"Awesome! You earned {earned_points} points.",
        "new_total_points": mock_user_points + earned_points,
        "current_streak": new_streak
    }
def calculate_rank(points: int) -> str:
    """Returns the user's rank based on their total points."""
    if points < 500:
        return "Novice Sprout"
    elif points < 1000:
        return "Eco Ranger"
    elif points < 1500:
        return "Nature Knight"
    elif points < 2000:
        return "Planet Guardian"
    else:
        return "Gaia Master"