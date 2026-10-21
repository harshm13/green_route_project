/**
 * GreenRoute Mobile - API Service Client
 * Connects directly to the FastAPI backend with multi-tenant headers and JWT tokens.
 */

// In development with Android emulator use 10.0.2.2, with iOS simulator use localhost, or computer LAN IP for physical device
export const DEFAULT_API_BASE = "http://10.0.2.2:8000";

let apiBaseUrl = DEFAULT_API_BASE;

export function setApiBaseUrl(url: string) {
  apiBaseUrl = url.replace(/\/$/, "");
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export interface SmartBin {
  id: number;
  name: string;
  tenant_id: string;
  zone: string;
  latitude: number;
  longitude: number;
  fill_level: number;
  is_full: boolean;
  capacity: number;
}

export interface ScanDepositResponse {
  message: string;
  earned_points: number;
  multiplier: number;
  new_total_points: number;
  streak: number;
  rank: string;
  geofence_status?: string;
}

export async function fetchAllBins(tenantId: string = "sou"): Promise<SmartBin[]> {
  try {
    const res = await fetch(`${apiBaseUrl}/bins/?tenant_id=${tenantId}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn("[Mobile API] Fetch bins failed:", error);
    return [];
  }
}

export async function submitQrDeposit(
  userId: number,
  binId: number,
  wasteType: string,
  userLat?: number,
  userLng?: number
): Promise<ScanDepositResponse> {
  const query = new URLSearchParams({
    waste_type: wasteType,
    bin_id: String(binId),
  });
  if (userLat !== undefined && userLng !== undefined) {
    query.append("user_lat", String(userLat));
    query.append("user_lng", String(userLng));
  }

  const url = `${apiBaseUrl}/users/${userId}/scan?${query.toString()}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Deposit failed (${res.status}): ${errText}`);
  }
  return await res.json();
}
