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

let currentAuthToken: string | null = null;
let currentAuthUser: any = null;

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
}

export function getAuthToken(): string | null {
  return currentAuthToken;
}

export function getCurrentUser(): any {
  return currentAuthUser;
}

export function getAuthHeaders(): HeadersInit {
  return currentAuthToken
    ? {
        "Authorization": `Bearer ${currentAuthToken}`,
        "Content-Type": "application/json"
      }
    : {
        "Content-Type": "application/json"
      };
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

export async function loginUser(email: string, password: string): Promise<any> {
  const res = await fetch(`${apiBaseUrl}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Authentication failed (${res.status})`);
  }
  const user = await res.json();
  currentAuthToken = user.access_token;
  currentAuthUser = user;
  return user;
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

export async function markBinEmptied(binId: number): Promise<SmartBin> {
  const res = await fetch(`${apiBaseUrl}/bins/${binId}/status?is_full=false`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server failed to update bin (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function submitQrDeposit(
  binIdOrUserId: number,
  wasteTypeOrBinId: string | number,
  userLatOrWasteType?: number | string,
  userLngOrLat?: number,
  userIdOrLng?: number
): Promise<ScanDepositResponse> {
  let binId: number;
  let wasteType: string;
  let userLat: number | undefined;
  let userLng: number | undefined;
  let userId: number | undefined;

  if (typeof wasteTypeOrBinId === "number") {
    // Called as: (userId, binId, wasteType, userLat, userLng)
    userId = binIdOrUserId;
    binId = wasteTypeOrBinId;
    wasteType = typeof userLatOrWasteType === "string" ? userLatOrWasteType : "plastic";
    userLat = typeof userLngOrLat === "number" ? userLngOrLat : undefined;
    userLng = typeof userIdOrLng === "number" ? userIdOrLng : undefined;
  } else {
    // Called as: (binId, wasteType, userLat, userLng, userId)
    binId = binIdOrUserId;
    wasteType = String(wasteTypeOrBinId || "plastic");
    userLat = typeof userLatOrWasteType === "number" ? userLatOrWasteType : undefined;
    userLng = typeof userLngOrLat === "number" ? userLngOrLat : undefined;
    userId = userIdOrLng;
  }

  const effectiveUserId = userId || currentAuthUser?.id;
  if (!effectiveUserId) {
    throw new Error("Authentication required: Please log in to submit scans and claim rewards.");
  }

  const query = new URLSearchParams({
    waste_type: wasteType,
    bin_id: String(binId),
  });
  if (userLat !== undefined && userLng !== undefined) {
    query.append("user_lat", String(userLat));
    query.append("user_lng", String(userLng));
  }

  const url = `${apiBaseUrl}/users/${effectiveUserId}/scan?${query.toString()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Deposit failed (${res.status})`);
  }
  return await res.json();
}
