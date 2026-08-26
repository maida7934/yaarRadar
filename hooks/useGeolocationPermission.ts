"use client";

import { useEffect, useState } from "react";

/**
 * "unsupported" means the Permissions API itself isn't available (older
 * Safari), not that geolocation is unavailable -- callers should still let
 * the user try in that case, they just can't know the answer up front.
 */
export type GeolocationPermission = "granted" | "prompt" | "denied" | "unsupported" | "checking";

/**
 * The current geolocation permission for this origin, kept live.
 *
 * Worth knowing why this matters: a denial is sticky. Once someone dismisses
 * or blocks the browser's prompt, the browser remembers it for the origin and
 * every later watchPosition/getCurrentPosition call fails instantly with
 * "User denied Geolocation" -- without re-prompting. No amount of retrying
 * from the page can bring the prompt back; only the user can, through
 * browser/site settings. Without querying this, a UI can only keep firing
 * requests that are guaranteed to fail and showing the raw error, which
 * reads as the app being broken rather than as a setting to change.
 *
 * The `change` listener matters too: if the user fixes the permission in
 * browser settings, that fires and the UI can recover on its own instead of
 * demanding a reload.
 */
export function useGeolocationPermission(): GeolocationPermission {
  // Resolved in the initialiser rather than by writing state from inside the
  // effect: whether the API exists is knowable synchronously, and setting
  // state during an effect is what the cascading-render rule flags. Safe
  // against hydration mismatch because the only consumer (FindScene) is
  // loaded with ssr:false, so this never renders on the server.
  const [state, setState] = useState<GeolocationPermission>(() =>
    typeof navigator === "undefined" || !navigator.permissions?.query ? "unsupported" : "checking",
  );

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;

    let cancelled = false;
    let status: PermissionStatus | null = null;
    const sync = () => {
      if (!cancelled && status) setState(status.state as GeolocationPermission);
    };

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        sync();
        result.addEventListener("change", sync);
      })
      .catch(() => {
        // Some browsers reject the geolocation query outright; treat that
        // the same as not having the API rather than as a denial.
        if (!cancelled) setState("unsupported");
      });

    return () => {
      cancelled = true;
      status?.removeEventListener("change", sync);
    };
  }, []);

  return state;
}
