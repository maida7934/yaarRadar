import { describe, expect, it } from "vitest";
import { haversineDistance, initialBearing, offsetCoords, type Coords } from "./geo";

const EQUATOR: Coords = { latitude: 0, longitude: 0 };
const ONE_DEGREE_NORTH: Coords = { latitude: 1, longitude: 0 };
const ONE_DEGREE_EAST: Coords = { latitude: 0, longitude: 1 };
const NORTH_POLE: Coords = { latitude: 90, longitude: 0 };

// One degree of latitude (moving along a meridian) is a great-circle arc,
// so distance = R * (1 degree in radians), independent of the haversine
// formula's handling of longitude — a clean analytical check.
const ONE_DEGREE_METERS = 6371000 * (Math.PI / 180);

describe("haversineDistance", () => {
  it("is zero for identical coordinates", () => {
    expect(haversineDistance(EQUATOR, EQUATOR)).toBeCloseTo(0, 6);
  });

  it("matches the analytical arc length for one degree of latitude", () => {
    expect(haversineDistance(EQUATOR, ONE_DEGREE_NORTH)).toBeCloseTo(ONE_DEGREE_METERS, 0);
  });

  it("matches the analytical arc length for one degree of longitude on the equator", () => {
    expect(haversineDistance(EQUATOR, ONE_DEGREE_EAST)).toBeCloseTo(ONE_DEGREE_METERS, 0);
  });

  it("matches a quarter of the Earth's circumference from the equator to the pole", () => {
    expect(haversineDistance(EQUATOR, NORTH_POLE)).toBeCloseTo(6371000 * (Math.PI / 2), 0);
  });

  it("is symmetric", () => {
    expect(haversineDistance(EQUATOR, ONE_DEGREE_NORTH)).toBeCloseTo(
      haversineDistance(ONE_DEGREE_NORTH, EQUATOR),
      6,
    );
  });
});

describe("initialBearing", () => {
  it("is due north (0°) moving along a meridian", () => {
    expect(initialBearing(EQUATOR, ONE_DEGREE_NORTH)).toBeCloseTo(0, 6);
  });

  it("is due south (180°) moving back along a meridian", () => {
    expect(initialBearing(ONE_DEGREE_NORTH, EQUATOR)).toBeCloseTo(180, 6);
  });

  it("is due east (90°) moving along the equator", () => {
    expect(initialBearing(EQUATOR, ONE_DEGREE_EAST)).toBeCloseTo(90, 6);
  });

  it("is due west (270°) moving back along the equator", () => {
    expect(initialBearing(ONE_DEGREE_EAST, EQUATOR)).toBeCloseTo(270, 6);
  });

  it("stays within [0, 360)", () => {
    const bearing = initialBearing(ONE_DEGREE_NORTH, EQUATOR);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });
});

describe("offsetCoords", () => {
  // Round-trips through haversineDistance/initialBearing at a handful of
  // bearings and distances typical of the mock-coords use case (5m-2000m)
  // -- this is what actually validates the whole pipeline is self-consistent.
  const origin: Coords = { latitude: 12.9716, longitude: 77.5946 };
  const cases: Array<{ distance: number; bearing: number }> = [
    { distance: 5, bearing: 0 },
    { distance: 80, bearing: 45 },
    { distance: 600, bearing: 120 },
    { distance: 1800, bearing: 200 },
    { distance: 350, bearing: 359 },
  ];

  it.each(cases)(
    "recovers distance $distance m and bearing $bearing° via haversineDistance/initialBearing",
    ({ distance, bearing }) => {
      const destination = offsetCoords(origin, distance, bearing);
      expect(haversineDistance(origin, destination)).toBeCloseTo(distance, 2);
      expect(initialBearing(origin, destination)).toBeCloseTo(bearing, 2);
    },
  );
});
