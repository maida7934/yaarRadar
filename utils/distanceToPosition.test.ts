import { describe, expect, it } from "vitest";
import {
  ARRIVED_THRESHOLD_METERS,
  MAX_METERS,
  MIN_METERS,
  distanceToCloseness,
  hasArrived,
} from "./distanceToPosition";

describe("distanceToCloseness", () => {
  it("returns 0 at the minimum distance", () => {
    expect(distanceToCloseness(MIN_METERS)).toBeCloseTo(0, 6);
  });

  it("returns 1 at the maximum distance", () => {
    expect(distanceToCloseness(MAX_METERS)).toBeCloseTo(1, 6);
  });

  it("clamps below the minimum distance to 0", () => {
    expect(distanceToCloseness(0)).toBeCloseTo(0, 6);
    expect(distanceToCloseness(-100)).toBeCloseTo(0, 6);
  });

  it("clamps above the maximum distance to 1", () => {
    expect(distanceToCloseness(MAX_METERS * 10)).toBeCloseTo(1, 6);
  });

  it("is monotonically increasing with distance", () => {
    const a = distanceToCloseness(50);
    const b = distanceToCloseness(500);
    const c = distanceToCloseness(1500);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("compresses the far end relative to the near end (log scale)", () => {
    // Same 10m absolute step should move `t` far more near the low end
    // than near the high end -- that's the whole point of the log scale.
    // (Equal-*ratio* steps, e.g. 10->20 vs 1000->2000, are a different
    // comparison: a log scale gives those roughly equal Δt by design.)
    const nearStep = distanceToCloseness(20) - distanceToCloseness(10);
    const farStep = distanceToCloseness(2000) - distanceToCloseness(1990);
    expect(nearStep).toBeGreaterThan(farStep);
  });
});

describe("hasArrived", () => {
  it("is true below the arrived threshold", () => {
    expect(hasArrived(ARRIVED_THRESHOLD_METERS - 1)).toBe(true);
  });

  it("is false at or above the arrived threshold", () => {
    expect(hasArrived(ARRIVED_THRESHOLD_METERS)).toBe(false);
    expect(hasArrived(ARRIVED_THRESHOLD_METERS + 1)).toBe(false);
  });
});
