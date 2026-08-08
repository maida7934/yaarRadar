import { describe, expect, it } from "vitest";
import { resolveDirection } from "./direction";

const ENTER = 7;
const EXIT = 3;

describe("resolveDirection", () => {
  it("stays straight while sway is within the enter threshold", () => {
    expect(resolveDirection(0, "straight", ENTER, EXIT)).toBe("straight");
    expect(resolveDirection(6, "straight", ENTER, EXIT)).toBe("straight");
    expect(resolveDirection(-6, "straight", ENTER, EXIT)).toBe("straight");
  });

  it("commits to right once sway exceeds the enter threshold", () => {
    expect(resolveDirection(8, "straight", ENTER, EXIT)).toBe("right");
  });

  it("commits to left once sway exceeds the enter threshold negatively", () => {
    expect(resolveDirection(-8, "straight", ENTER, EXIT)).toBe("left");
  });

  it("stays right even as sway drops below enter, as long as it's above exit", () => {
    expect(resolveDirection(5, "right", ENTER, EXIT)).toBe("right");
  });

  it("returns to straight only once sway drops below the exit threshold", () => {
    expect(resolveDirection(2, "right", ENTER, EXIT)).toBe("straight");
    expect(resolveDirection(-2, "left", ENTER, EXIT)).toBe("straight");
  });

  it("does not flicker back to straight from a value between exit and enter", () => {
    // This is the whole point of hysteresis: 5 is below `enter` (7) but
    // above `exit` (3), so a direction already committed to should hold.
    expect(resolveDirection(5, "right", ENTER, EXIT)).toBe("right");
    expect(resolveDirection(-5, "left", ENTER, EXIT)).toBe("left");
  });

  it("crosses directly from left to right without passing through straight", () => {
    expect(resolveDirection(9, "left", ENTER, EXIT)).toBe("right");
    expect(resolveDirection(-9, "right", ENTER, EXIT)).toBe("left");
  });
});
