/**
 * Calculates the distance between two GPS coordinates in meters using the Haversine formula.
 */
export function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // returns distance in meters
}

/**
 * Checks if the user's location is within the specified radius of the home location.
 * @param userLat User's current latitude
 * @param userLon User's current longitude
 * @param homeLat Pinned home latitude
 * @param homeLon Pinned home longitude
 * @param radius Threshold radius in meters (default is 100 meters)
 */
export function isInsideHomeRadius(
  userLat: number,
  userLon: number,
  homeLat: number,
  homeLon: number,
  radius: number = 100
): boolean {
  const distance = getDistanceInMeters(userLat, userLon, homeLat, homeLon);
  return distance <= radius;
}
