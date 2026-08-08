/**
 * Adjusts `nextWrappedDegrees` (a 0-360 wrapped compass bearing) by whole
 * rotations so it's continuous with `previousUnwrapped`, taking the shorter
 * path across the 0/360 boundary. Feed the result into a spring/animation
 * instead of the raw wrapped value -- otherwise a bearing crossing due
 * north (e.g. 359 -> 1) snaps the animation the long way around through
 * 180 instead of drifting the short 2-degree distance through 0.
 */
export function unwrapDegrees(previousUnwrapped: number, nextWrappedDegrees: number): number {
  const previousWrapped = ((previousUnwrapped % 360) + 360) % 360;
  let delta = nextWrappedDegrees - previousWrapped;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return previousUnwrapped + delta;
}
