import { describe, expect, it } from "vitest";
import { USERNAME_COOLDOWN_DAYS, usernameCooldownDaysLeft } from "./usernameCooldown";

const DAY = 86_400_000;
const NOW = Date.parse("2026-08-23T12:00:00.000Z");
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe("usernameCooldownDaysLeft", () => {
  it("allows a rename on an account that has never been renamed", () => {
    expect(usernameCooldownDaysLeft(null, NOW)).toBe(0);
  });

  it("reports the full window immediately after a rename", () => {
    expect(usernameCooldownDaysLeft(at(0), NOW)).toBe(USERNAME_COOLDOWN_DAYS);
  });

  it("counts down as the window elapses", () => {
    expect(usernameCooldownDaysLeft(at(3 * DAY), NOW)).toBe(7);
    expect(usernameCooldownDaysLeft(at(9 * DAY), NOW)).toBe(1);
  });

  it("rounds up a partial day rather than reporting 0 while still locked", () => {
    // 9.5 days elapsed: half a day remains, and the backend would still
    // refuse -- so this must not read as 0.
    expect(usernameCooldownDaysLeft(at(9.5 * DAY), NOW)).toBe(1);
  });

  it("unlocks exactly at the boundary", () => {
    expect(usernameCooldownDaysLeft(at(USERNAME_COOLDOWN_DAYS * DAY), NOW)).toBe(0);
  });

  it("stays unlocked long after the window", () => {
    expect(usernameCooldownDaysLeft(at(400 * DAY), NOW)).toBe(0);
  });

  it("does not lock the field on an unparseable timestamp", () => {
    expect(usernameCooldownDaysLeft("not-a-date", NOW)).toBe(0);
  });
});
