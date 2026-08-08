"use client";

import { useMemo } from "react";
import { haversineDistance, initialBearing, type Coords } from "@/utils/geo";

export function useDistanceBearing(me: Coords, friend: Coords) {
  // Deliberately depend on the primitive lat/lng values, not `me`/`friend`
  // themselves -- callers (e.g. useFindDemo) return fresh coordinate
  // objects every render, so depending on the objects would recompute on
  // every render regardless of whether the actual position changed.
  return useMemo(
    () => ({
      distance: haversineDistance(me, friend),
      bearing: initialBearing(me, friend),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me.latitude, me.longitude, friend.latitude, friend.longitude],
  );
}
