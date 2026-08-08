export const MIN_METERS = 5;
export const MAX_METERS = 2000;
export const ARRIVED_THRESHOLD_METERS = 10;

/**
 * Maps a real-world distance (meters) to a 0..1 "closeness" value for the
 * road scene: 0 = as close as the scene ever renders, 1 = as far as the
 * scene ever renders. Log-scaled so near-field changes (the ones that
 * actually matter when you're closing in on someone) stay visually
 * meaningful instead of being swamped by the far end of the range.
 */
export function distanceToCloseness(distanceMeters: number): number {
  const clamped = Math.min(Math.max(distanceMeters, MIN_METERS), MAX_METERS);

  const logMin = Math.log(MIN_METERS + 1);
  const logMax = Math.log(MAX_METERS + 1);
  const logValue = Math.log(clamped + 1);

  return (logValue - logMin) / (logMax - logMin);
}

export function hasArrived(distanceMeters: number): boolean {
  return distanceMeters < ARRIVED_THRESHOLD_METERS;
}
