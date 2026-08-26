"use client";

import { useEffect, useRef, useState } from "react";
import type { Coords } from "@/utils/geo";

// Browsers/devices commonly deliver a fast, coarse fix first (WiFi/cell-
// tower-based, easily off by hundreds of meters to kilometers) before a
// precise GPS fix follows a few seconds later -- accepting every fix as it
// arrives means that first bad one briefly shows a wildly wrong distance.
// `position.coords.accuracy` is the radius (meters) of the reported fix's
// own 95%-confidence circle; fixes worse than this are preferred against,
// but see ACCURACY_GRACE_PERIOD_MS below -- this is a preference, not a
// hard requirement, because some devices/browsers can never produce a fix
// this good (see next comment).
const MAX_ACCEPTABLE_ACCURACY_METERS = 100;

// A laptop/desktop browser has no GPS chip -- it geolocates via WiFi/IP,
// which routinely reports accuracy in the hundreds to thousands of meters
// even when working correctly (not a bad fix, just a coarser method than a
// phone's GPS). A hard `accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS`
// requirement with no fallback would leave a device like that stuck on
// `coords: null` forever -- rejecting every fix it's physically capable of
// producing, with `coords` never resolving and the UI hanging on "Locating
// you..." indefinitely. So: prefer a fix under the threshold, but if
// nothing that good arrives within this long, stop waiting and accept the
// best fix seen so far instead. Once a fix under the threshold does land
// (immediately on a phone with a clear sky view; never, on most desktop
// browsers), grace-period fallback fixes are no longer accepted -- a
// confirmed-good source shouldn't get interrupted by an occasional bad
// blip mixed into an otherwise good stream.
const ACCURACY_GRACE_PERIOD_MS = 15000;

// Logs every raw fix's accuracy and accept/reject verdict to the console.
// Deliberately not gated behind NODE_ENV, since the thing being debugged is
// real-device GPS behavior on a deployed build, not local dev -- which is
// also why it stays off by default: the log line includes the user's exact
// latitude/longitude, and that shouldn't be sitting in the console of a
// shipped build. Flip to true while actively debugging a device, then back.
const DEBUG_GEO = false;

export interface GeolocationState {
  coords: Coords | null;
  error: string | null;
  /** Accuracy (meters, smaller = better) of the fix `coords` was actually
   * set from -- null until a fix has been accepted at least once. Useful
   * for surfacing "this position might be rough" in the UI. */
  accuracy: number | null;
}

/**
 * Wraps `navigator.geolocation.watchPosition`, only actually watching while
 * `enabled` is true -- so toggling location off both stops draining battery
 * and lets the browser's permission prompt wait until the user opts in,
 * rather than firing on every page load.
 */
export function useGeolocation(enabled: boolean): GeolocationState {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  // When this watch session started -- the clock ACCURACY_GRACE_PERIOD_MS
  // counts down from -- and whether a fix under the ideal threshold has
  // ever landed, which permanently turns off grace-period fallback.
  const watchStartedAtRef = useRef<number>(0);
  const hasAcceptedGoodFixRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      queueMicrotask(() => {
        setCoords(null);
        setError(null);
        setAccuracy(null);
      });
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      queueMicrotask(() => setError("Geolocation isn't available on this device."));
      return;
    }

    watchStartedAtRef.current = Date.now();
    hasAcceptedGoodFixRef.current = false;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const fixAccuracy = position.coords.accuracy;
        const isGood = fixAccuracy <= MAX_ACCEPTABLE_ACCURACY_METERS;
        const withinGracePeriod = Date.now() - watchStartedAtRef.current < ACCURACY_GRACE_PERIOD_MS;
        // Accept a good fix outright; otherwise only accept as a fallback
        // while still within the grace period and nothing good has landed
        // yet -- see ACCURACY_GRACE_PERIOD_MS above.
        const accept = isGood || (!hasAcceptedGoodFixRef.current && !withinGracePeriod);

        if (DEBUG_GEO) {
          console.debug(
            `[useGeolocation] fix accuracy=${fixAccuracy.toFixed(0)}m` +
              ` verdict=${accept ? (isGood ? "accepted (good)" : "accepted (grace-period fallback)") : "dropped"}` +
              ` lat=${position.coords.latitude.toFixed(6)} lng=${position.coords.longitude.toFixed(6)}`,
          );
        }

        if (!accept) return;
        if (isGood) hasAcceptedGoodFixRef.current = true;
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setAccuracy(fixAccuracy);
        setError(null);
      },
      (err) => {
        if (DEBUG_GEO) console.debug(`[useGeolocation] watchPosition error: ${err.message}`);
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

  return { coords, error, accuracy };
}
