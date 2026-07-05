/*
 * FILE: src/utils/locationUtils.ts
 * PURPOSE: Geolocation utility module to measure distances between GPS coordinate markers
 *          and determine if a user is inside or outside their household radius boundary.
 * WHERE USED: Used in Screens (ProfileScreen, HomeLocationModal) to track status (e.g. at home vs out).
 */

/**
 * Calculates the distance between two GPS coordinates in meters using the Haversine formula.
 */
export function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Constant representing the mean radius of Earth in meters
  const R = 6371e3;
  // Convert latitude 1 from degrees to radians
  const phi1 = (lat1 * Math.PI) / 180;
  // Convert latitude 2 from degrees to radians
  const phi2 = (lat2 * Math.PI) / 180;
  // Calculate latitude differential in radians
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  // Calculate longitude differential in radians
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  // Apply Haversine trigonometric formula variables
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  // Calculate angular distance in radians
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Compute final linear distance in meters
  return R * c;
}

/**
 * Checks if the user's location is within the specified radius of the home location.
 */
export function isInsideHomeRadius(
  userLat: number,
  userLon: number,
  homeLat: number,
  homeLon: number,
  radius: number = 100
): boolean {
  // Determine distance between user and home pin in meters
  const distance = getDistanceInMeters(userLat, userLon, homeLat, homeLon);
  // Return true if computed distance falls below the safety boundary radius threshold
  return distance <= radius;
}
