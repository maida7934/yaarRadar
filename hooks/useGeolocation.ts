"use client";

import { useEffect, useRef, useState } from "react";
import type { Coords } from "@/utils/geo";

// Browsers/devices commonly deliver a fast, coarse fix first (WiFi/cell-
// tower-based, easily off by hundreds of meters to kilometers) before a
// precise GPS fix follows a few seconds later -- accepting every fix as it
// arrives means that first bad one briefly shows a wildly wrong distance.
// `position.coords.accuracy` is the radius (meters) of the reported
// fix's own 95%-confidence circle; fixes worse than this are dropped
// rather than shown, so `coords` only ever reflects a fix worth trusting.
const MAX_ACCEPTABLE_ACCURACY_METERS = 100;

/**
 * Wraps `navigator.geolocation.watchPosition`, only actually watching while
 * `enabled` is true -- so toggling location off both stops draining battery
 * and lets the browser's permission prompt wait until the user opts in,
 * rather than firing on every page load.
 */
export function useGeolocation(enabled: boolean): { coords: Coords | null; error: string | null } {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      queueMicrotask(() => {
        setCoords(null);
        setError(null);
      });
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      queueMicrotask(() => setError("Geolocation isn't available on this device."));
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (position.coords.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
          // Not necessarily wrong -- just not trustworthy enough to show or
          // act on. A better fix typically follows within a few seconds
          // (watchPosition keeps calling back); until then, leave `coords`
          // at whatever the last good fix was (or null on the very first
          // fix), rather than jump to a fix that could be badly off.
          return;
        }
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setError(null);
      },
      (err) => {
        setError(err.message || "Could not get your location.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled]);

  return { coords, error };
}
