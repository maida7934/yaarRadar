"use client";

import { useEffect, useRef, useState } from "react";
import type { Coords } from "@/utils/geo";

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
