import os
import io
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw, ImageFont
from typing import Optional, Dict, Any, List
import hashlib
import hmac
import zipfile
from .auth_utils import SECRET_KEY

DEFAULT_FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5500")

def generate_bin_qr_token(bin_id: int, tenant_id: str = "sou") -> str:
    """Computes a cryptographically verified, server-authenticated token for a physical smart bin."""
    message = f"GREENROUTE:BIN:{tenant_id}:{bin_id}".encode("utf-8")
    token = hmac.new(SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()[:16]
    return token

def verify_bin_qr_token(bin_id: int, tenant_id: str, token: str) -> bool:
    """Verifies that a scanned QR token matches the server-signed identity for the bin."""
    if not token:
        return False
    expected = generate_bin_qr_token(bin_id, tenant_id)
    return hmac.compare_digest(expected.lower(), token.strip().lower())

def get_bin_qr_payload(
    bin_id: int,
    tenant_id: str = "sou",
    frontend_url: Optional[str] = None
) -> str:
    """
    Constructs the canonical deep-link URL encoded into the physical smart bin QR sticker.
    Points to the Citizen frontend URL with server-validated QR identity token.
    """
    target_url = (frontend_url or DEFAULT_FRONTEND_URL).rstrip("/")
    qr_token = generate_bin_qr_token(bin_id, tenant_id)
    return f"{target_url}/citizen.html?bin_id={bin_id}&tenant={tenant_id}&qr_token={qr_token}"

def generate_bin_qr_code(
    bin_id: int,
    tenant_id: str = "sou",
    frontend_url: Optional[str] = None,
    base_url: Optional[str] = None, # Backwards compatibility alias
    fill_color: str = "#065F46",
    back_color: str = "#FFFFFF",
    box_size: int = 10,
    border: int = 2
) -> Image.Image:
    """
    Generates a high-resolution QR code image with Error Correction Level H (~30% recovery).
    High error correction ensures stickers scratched or soiled in outdoor weather remain 100% scannable.
    """
    url = frontend_url or base_url or DEFAULT_FRONTEND_URL
    payload = get_bin_qr_payload(bin_id, tenant_id, frontend_url=url)
    
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=box_size,
        border=border,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color=fill_color, back_color=back_color).convert("RGBA")
    return img


def generate_printable_bin_label(
    bin_data: Dict[str, Any],
    frontend_url: Optional[str] = None,
    base_url: Optional[str] = None
) -> bytes:
    """
    Generates an industrial-ready, high-resolution physical bin sticker label (700 x 950 px).
    Includes:
    - GreenRoute brand banner
    - Bin name & ID
    - Campus / Tenant zone
    - Verified GPS Geofence coordinates
    - Scannable QR code matrix
    - Deposit instructions
    - Accepted waste material symbols
    - Unique cryptographic tamper serial verified by server
    """
    width = 700
    height = 950
    bg_color = (255, 255, 255)
    
    canvas = Image.new("RGBA", (width, height), bg_color)
    draw = ImageDraw.Draw(canvas)
    
    # Outer Border (Industrial Rounded Rectangle Look)
    border_color = (16, 185, 129)  # Emerald #10B981
    draw.rectangle([(8, 8), (width - 8, height - 8)], outline=border_color, width=4)
    
    # Header Banner (Deep Emerald Gradient Simulation)
    header_height = 110
    draw.rectangle([(8, 8), (width - 8, header_height)], fill=(6, 95, 70))  # #065F46
    
    # Header Title
    title_text = "GREENROUTE SMART ECO-BIN"
    subtitle_text = "CAMPUS CIRCULAR ZERO-WASTE NETWORK"
    
    draw.text((width // 2, 40), title_text, fill=(255, 255, 255), anchor="mm")
    draw.text((width // 2, 75), subtitle_text, fill=(167, 243, 208), anchor="mm")
    
    # Bin Information Section
    bin_id = bin_data.get("id", 1)
    bin_name = bin_data.get("name", f"Smart Bin #{bin_id}")
    tenant_id = bin_data.get("tenant_id", "sou").upper()
    zone = bin_data.get("zone", "General").title()
    lat = bin_data.get("latitude", bin_data.get("lat", 23.0754))
    lng = bin_data.get("longitude", bin_data.get("lng", 72.5082))
    
    # Bin Name Header
    draw.text((width // 2, 145), f"BIN #{bin_id:03d} • {bin_name.upper()}", fill=(15, 23, 42), anchor="mm")
    
    # Location & Geofence Badge
    geo_badge_text = f"CAMPUS: {tenant_id} | ZONE: {zone.upper()} | 📍 {lat:.4f}°N, {lng:.4f}°E (±50m Geofence)"
    draw.rectangle([(30, 175), (width - 30, 210)], fill=(236, 253, 245), outline=(167, 243, 208), width=1)
    draw.text((width // 2, 192), geo_badge_text, fill=(4, 120, 87), anchor="mm")
    
    # QR Code Generation (360x360 px)
    effective_url = frontend_url or base_url or DEFAULT_FRONTEND_URL
    qr_img = generate_bin_qr_code(
        bin_id=bin_id,
        tenant_id=bin_data.get("tenant_id", "sou"),
        frontend_url=effective_url,
        fill_color="#065F46",
        box_size=9,
        border=1
    )
    qr_target_size = 380
    qr_resized = qr_img.resize((qr_target_size, qr_target_size), Image.Resampling.NEAREST)
    
    # Center QR on Canvas
    qr_x = (width - qr_target_size) // 2
    qr_y = 230
    
    # Draw subtle card container for QR
    draw.rectangle(
        [(qr_x - 12, qr_y - 12), (qr_x + qr_target_size + 12, qr_y + qr_target_size + 12)],
        fill=(248, 250, 252),
        outline=(203, 213, 225),
        width=2
    )
    
    # Paste QR Code
    canvas.paste(qr_resized, (qr_x, qr_y), qr_resized)
    
    # Scan Call to Action
    cta_y = qr_y + qr_target_size + 35
    draw.text((width // 2, cta_y), "SCAN WITH SMARTPHONE CAMERA OR APP", fill=(16, 185, 129), anchor="mm")
    draw.text((width // 2, cta_y + 25), "Instant Point Claim • AI Waste Segregation Verification", fill=(75, 85, 99), anchor="mm")
    
    # Material Accepted Section
    mat_y = cta_y + 70
    draw.line([(40, mat_y), (width - 40, mat_y)], fill=(226, 232, 240), width=2)
    
    # Waste Category Pills
    draw.text((width // 2, mat_y + 20), "ACCEPTED SEGREGATED MATERIALS:", fill=(30, 41, 59), anchor="mm")
    materials = ["[ PLASTIC BOTTLES ]", "[ ALUMINUM CANS ]", "[ ORGANIC SCRAPS ]", "[ E-WASTE BATTERIES ]"]
    draw.text((width // 2, mat_y + 48), "    ".join(materials), fill=(4, 120, 87), anchor="mm")
    
    # Unique Cryptographic Security Serial at bottom
    verified_token = generate_bin_qr_token(bin_id, bin_data.get("tenant_id", "sou"))
    serial_code = f"TAG UID: GR-{tenant_id}-{bin_id:04d}-{verified_token.upper()}  |  OFFICIAL HARDWARE SPEC REV 2.4"
    
    draw.rectangle([(8, height - 42), (width - 8, height - 8)], fill=(241, 245, 249))
    draw.text((width // 2, height - 25), serial_code, fill=(100, 116, 139), anchor="mm")
    
    # Output to PNG bytes
    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    return buf.getvalue()


def generate_all_labels_zip(
    bins_list: List[Dict[str, Any]],
    frontend_url: Optional[str] = None,
    base_url: Optional[str] = None
) -> bytes:
    """
    Batches all printable bin labels into a single compressed ZIP file for production printing.
    """
    effective_url = frontend_url or base_url or DEFAULT_FRONTEND_URL
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for b in bins_list:
            b_id = b.get("id", 1)
            b_name = b.get("name", f"bin_{b_id}").replace(" ", "_").lower()
            label_png = generate_printable_bin_label(b, frontend_url=effective_url)
            filename = f"greenroute_bin_label_{b_id:03d}_{b_name}.png"
            zf.writestr(filename, label_png)
            
            # Also include raw QR matrix
            qr_img = generate_bin_qr_code(b_id, b.get("tenant_id", "sou"), frontend_url=effective_url)
            qr_buf = io.BytesIO()
            qr_img.save(qr_buf, format="PNG")
            zf.writestr(f"qr_codes/qr_matrix_{b_id:03d}.png", qr_buf.getvalue())
            
    return zip_buf.getvalue()
