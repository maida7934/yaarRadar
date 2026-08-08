import { describe, expect, it } from "vitest";
import { BEARING_SWAY_PERCENT, bearingToSway } from "./bearingToSway";

describe("bearingToSway", () => {
  it("is centered (0) due north", () => {
    expect(bearingToSway(0)).toBeCloseTo(0, 6);
  });

  it("is centered (0) due south", () => {
    expect(bearingToSway(180)).toBeCloseTo(0, 6);
  });

  it("is at full positive sway due east", () => {
    expect(bearingToSway(90)).toBeCloseTo(BEARING_SWAY_PERCENT, 6);
  });

  it("is at full negative sway due west", () => {
    expect(bearingToSway(270)).toBeCloseTo(-BEARING_SWAY_PERCENT, 6);
  });

  it("never exceeds the sway cap in either direction", () => {
    for (let deg = 0; deg < 360; deg += 15) {
      expect(Math.abs(bearingToSway(deg))).toBeLessThanOrEqual(BEARING_SWAY_PERCENT + 1e-9);
    }
  });

  it("is periodic for unwrapped angles beyond 360", () => {
    expect(bearingToSway(450)).toBeCloseTo(bearingToSway(90), 6);
    expect(bearingToSway(-90)).toBeCloseTo(bearingToSway(270), 6);
  });
});
