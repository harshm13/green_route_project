from datetime import datetime
from typing import Optional, List

# --- 1. QR Validation Logic ---
def validate_qr_scan(scanned_bin_id: Optional[str], valid_bin_ids: List[str]) -> bool:
    """
    Checks if the scanned QR code matches a valid, registered smart bin.
    """
    if not scanned_bin_id:
        return False
    return str(scanned_bin_id) in [str(b) for b in valid_bin_ids]

# --- 2. Streak Calculation Logic ---
def update_streak(last_scan_date: Optional[datetime], current_streak: int) -> int:
    """
    Calculates consecutive day recycling streak.
    - If scanned yesterday: increment streak.
    - If scanned today: keep current streak (already counted).
    - If missed a day or first scan: reset streak to 1.
    """
    if not last_scan_date:
        return 1 # First time scanning

    today = datetime.now().date()
    last_scan = last_scan_date.date()
    delta_days = (today - last_scan).days

    if delta_days == 1:
        return (current_streak or 0) + 1 # Streak continues!
    elif delta_days == 0:
        return max(1, current_streak or 1) # Already scanned today
    else:
        return 1 # Streak reset

# --- 3. Point Calculation & Waste Multipliers ---
def calculate_earned_points(base_points: int, current_streak: int, waste_type: str = "general") -> int:
    """
    Calculates earned points based on base reward, user streak, and material difficulty.
    E-Waste (+50%), Organic (+15%), Plastic (+10%).
    Streak >= 7 (+50%), Streak >= 3 (+20%).
    """
    multiplier = 1.0

    # Streak multipliers
    if (current_streak or 0) >= 7:
        multiplier += 0.5
    elif (current_streak or 0) >= 3:
        multiplier += 0.2

    # Material segregation multipliers
    w = (waste_type or "general").lower()
    if w == "e-waste":
        multiplier += 0.5
    elif w == "organic":
        multiplier += 0.15
    elif w == "plastic":
        multiplier += 0.10

    return int(base_points * multiplier)

# --- 4. Rank Tier Progression ---
def calculate_rank(points: int) -> str:
    """Returns the user's gamified rank tier based on cumulative points."""
    pts = points or 0
    if pts < 500:
        return "Novice Sprout"
    elif pts < 1000:
        return "Eco Ranger"
    elif pts < 1500:
        return "Nature Knight"
    elif pts < 2000:
        return "Planet Guardian"
    else:
        return "Gaia Master"