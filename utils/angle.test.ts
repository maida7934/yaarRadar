import { describe, expect, it } from "vitest";
import { unwrapDegrees } from "./angle";

describe("unwrapDegrees", () => {
  it("passes through a simple no-wrap change unchanged", () => {
    expect(unwrapDegrees(100, 120)).toBeCloseTo(120, 6);
    expect(unwrapDegrees(190, 170)).toBeCloseTo(170, 6);
  });

  it("continues forward through the 360/0 boundary instead of jumping back", () => {
    // 350 -> 10 is a short +20 step through north, not a -340 step.
    expect(unwrapDegrees(350, 10)).toBeCloseTo(370, 6);
  });

  it("continues backward through the 0/360 boundary instead of jumping forward", () => {
    expect(unwrapDegrees(10, 350)).toBeCloseTo(-10, 6);
  });

  it("accumulates across repeated wraps in the same direction", () => {
    let unwrapped = 350;
    unwrapped = unwrapDegrees(unwrapped, 10); // 370
    unwrapped = unwrapDegrees(unwrapped, 30); // 390
    expect(unwrapped).toBeCloseTo(390, 6);
  });

  it("is a no-op when the previous value is already unwrapped past 360", () => {
    expect(unwrapDegrees(370, 30)).toBeCloseTo(390, 6);
  });
});
