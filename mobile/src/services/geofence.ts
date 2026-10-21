/**
 * GreenRoute Mobile - Geofence & Proximity Engine
 * Validates citizen GPS location against smart bin coordinates using Haversine formula.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function calculateDistanceMeters(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);

  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function isWithinGeofence(
  userCoord: Coordinates,
  binCoord: Coordinates,
  radiusMeters: number = 50
): { isVerified: boolean; distanceMeters: number } {
  const distance = calculateDistanceMeters(userCoord, binCoord);
  return {
    isVerified: distance <= radiusMeters,
    distanceMeters: distance,
  };
}
