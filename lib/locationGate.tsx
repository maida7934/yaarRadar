"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useGeolocationPermission } from "@/hooks/useGeolocationPermission";

interface LocationGateValue {
  /** True once the location question has been put to the user and answered
   * -- or established as unanswerable. Anything queued behind the location
   * prompt waits on this. */
  settled: boolean;
  /** Call when the question is closed without a browser prompt ever firing
   * (declining the primer), or when geolocation has resolved by callback on
   * a browser where the permission state can't be observed. */
  markSettled: () => void;
}

const LocationGateContext = createContext<LocationGateValue | null>(null);

/** Remembers that the up-front location explainer has been answered. Owned
 * here rather than by the component that renders it, because the gate has to
 * read it too -- see the deadlock note in the provider. */
export const LOCATION_PRIMER_STORAGE_KEY = "yaarRadar:locationPrimerSeen";

/**
 * Sequences the app's two opening interruptions so they don't land at once.
 *
 * Location is asked first because it's the one the app can't work without,
 * and because a browser denial is permanent -- it deserves the user's full
 * attention rather than competing with a tutorial for it. The How-To-Use
 * popup waits on `settled` and appears afterwards.
 *
 * "Settled" deliberately means *answered*, not *granted*: denying is a
 * complete answer and How-To-Use should follow either way.
 *
 * Three ways it settles, and all three are needed or the popup can wait
 * forever on a prompt that is never coming:
 *  - the permission resolves to granted/denied -- the normal path, covering
 *    both the primer's button and a persisted toggle that prompts on mount;
 *  - the user declines the primer, so no browser prompt will fire at all;
 *  - the Permissions API isn't available (older Safari), so resolution can't
 *    be observed -- callers fall back to marking it from geolocation's own
 *    success/error callback.
 */
export function LocationGateProvider({ children }: { children: ReactNode }) {
  const permission = useGeolocationPermission();
  // Seeded from the persisted primer answer, not just false.
  //
  // The flag is localStorage (it outlives the tab) while this state is
  // per-session, and that mismatch deadlocked the gate: on a later visit
  // with the permission still on "prompt", the primer wouldn't render
  // because it had already been answered, so nothing could call
  // markSettled, so `settled` stayed false and everything queued behind it
  // never appeared. Reading the same flag the primer writes is what closes
  // that loop.
  const [manuallySettled, setManuallySettled] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(LOCATION_PRIMER_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const markSettled = useCallback(() => setManuallySettled(true), []);

  // "checking" and "prompt" are the only states still awaiting an answer.
  // "unsupported" can never resolve on its own, so it doesn't gate -- the
  // geolocation callback marks it instead, and until then the popup showing
  // is far better than it never showing.
  const settled =
    manuallySettled ||
    permission === "granted" ||
    permission === "denied" ||
    permission === "unsupported";

  const value = useMemo(() => ({ settled, markSettled }), [settled, markSettled]);

  return <LocationGateContext.Provider value={value}>{children}</LocationGateContext.Provider>;
}

export function useLocationGate(): LocationGateValue {
  const ctx = useContext(LocationGateContext);
  // Outside a provider nothing is sequencing anything, so don't hold
  // anything back.
  return ctx ?? { settled: true, markSettled: () => {} };
}
