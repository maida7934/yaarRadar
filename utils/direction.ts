export type FacingDirection = "straight" | "left" | "right";

/**
 * Resolves which discrete sprite direction to show from a continuous sway
 * value, with hysteresis: `enter` is the magnitude needed to commit to a
 * turn from "straight", `exit` (< enter) is how far back toward center it
 * has to come before returning to "straight". Without the gap between
 * them, sway hovering right at one threshold would flicker between two
 * sprites every frame.
 */
export function resolveDirection(
  sway: number,
  previous: FacingDirection,
  enter: number,
  exit: number,
): FacingDirection {
  if (previous === "left") {
    if (sway > enter) return "right";
    if (sway > -exit) return "straight";
    return "left";
  }
  if (previous === "right") {
    if (sway < -enter) return "left";
    if (sway < exit) return "straight";
    return "right";
  }
  if (sway > enter) return "right";
  if (sway < -enter) return "left";
  return "straight";
}
