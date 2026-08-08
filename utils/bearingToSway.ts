export const BEARING_SWAY_PERCENT = 22;

/**
 * Maps a compass bearing (degrees; may be an unwrapped value beyond 0-360,
 * see utils/angle.ts) to a horizontal screen offset from center, in
 * percent. 0/360 (north, "in front of you") -> center; 90 (east) -> full
 * sway right; 270 (west) -> full sway left. Capped by BEARING_SWAY_PERCENT
 * so a bearing change reads as a gentle compass-like drift rather than a
 * needle swinging across the whole screen.
 */
export function bearingToSway(bearingDegrees: number): number {
  const radians = (bearingDegrees * Math.PI) / 180;
  return Math.sin(radians) * BEARING_SWAY_PERCENT;
}
