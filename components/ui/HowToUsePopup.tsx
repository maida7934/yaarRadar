"use client";

import { useEffect, useState } from "react";
import { NotchedFrame } from "@/components/ui/NotchedFrame";
import { HowToUseSteps } from "@/components/ui/HowToUseSteps";
import { HOW_TO_USE_TITLE } from "@/lib/howToUse";
import { useLocationGate } from "@/lib/locationGate";

/** sessionStorage, not localStorage, on purpose: "shows when the app
 * opens" should mean once per app launch, not once per browser forever.
 * A PWA launched from the home screen gets a fresh session each time, so
 * it reappears then, but tab-to-tab navigation inside a session doesn't
 * re-trigger it. Clear this key (or open a new tab) to see it again. */
const SEEN_KEY = "yaarradar:how-to-use-seen";

/**
 * The short "how to use" card shown over the app the first time it opens
 * after login -- dismissed with the X, and always re-readable from
 * Settings -> HOW TO USE (same copy, see lib/howToUse.ts).
 *
 * Mounted from AuthGate rather than from a page, so it survives tab
 * navigation (the root layout persists across App Router route changes)
 * and can't fire again every time the Find scene remounts.
 *
 * Styling deliberately reuses NotchedFrame and the warm cream palette the
 * login form and settings drawer already use, rather than PixelModal's
 * black/white game-UI look -- this sits on top of the scene, so it should
 * read as part of the same window furniture.
 */
export function HowToUsePopup() {
  // Lazy initialiser rather than an effect: AuthGate renders its LOADING
  // branch until the session resolves, so this component only ever mounts
  // client-side, after hydration -- there's no server render of it to
  // mismatch, and reading storage up front avoids a frame where the popup
  // is mounted-but-closed (which an effect + setState would cause, and
  // which the cascading-renders lint rule flags).
  // Queued behind the location prompt rather than racing it -- two
  // interruptions arriving together means neither gets read. `settled` flips
  // once the user has answered the browser prompt (either way), declined the
  // primer, or landed on a browser where the answer can't be observed.
  const { settled } = useLocationGate();

  const [dismissed, setDismissed] = useState(() => {
    // Guarded anyway: sessionStorage is absent on the server and throws
    // outright in private mode or when site data is blocked.
    if (typeof window === "undefined") return true;
    try {
      return window.sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      return false; // Storage unavailable -- show it rather than suppress it.
    }
  });

  // Two conditions, not one: it has to be this session's first showing AND
  // the location question has to be out of the way.
  const open = !dismissed && settled;

  const close = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Can't persist the dismissal; it still closes for this render.
    }
  };

  // Escape closes it, same as clicking the backdrop or the X.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={HOW_TO_USE_TITLE}
    >
      <div
        className="relative w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Same three-ring frame as the login form's card. */}
        <NotchedFrame colors={["#98755b", "#d4bbac", "#fdf1e5"]} step={5} ringWidth={4} />

        <div className="flex items-center justify-between gap-3 mb-3">
          <h2
            style={{
              fontFamily: "var(--font-pixel)",
              color: "#5a4632",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.06em",
            }}
          >
            {HOW_TO_USE_TITLE}
          </h2>
          {/* Matches the settings drawer's close button exactly. */}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex items-center justify-center shrink-0"
            style={{
              width: 28,
              height: 28,
              border: "2px solid #8C6551",
              borderRadius: 6,
              backgroundColor: "#bfc08e",
              color: "#5a4632",
              fontFamily: "var(--font-pixel)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            X
          </button>
        </div>

        {/* Capped so a small phone in landscape can still scroll the list
            and reach the button, without the frame itself scrolling. The
            step list itself is shared with the settings drawer's HOW TO USE
            panel -- see HowToUseSteps. */}
        <div className="overflow-y-auto" style={{ maxHeight: "58dvh" }}>
          <HowToUseSteps compact />
        </div>

        <button
          type="button"
          onClick={close}
          className="w-full mt-4"
          style={{
            padding: "10px 14px",
            backgroundColor: "#bfc08e",
            border: "3px solid #8C6551",
            borderRadius: 10,
            fontFamily: "var(--font-pixel)",
            fontSize: 12,
            fontWeight: 700,
            color: "#5a4632",
            letterSpacing: "0.06em",
          }}
        >
          GOT IT
        </button>

        <p
          className="text-center mt-2"
          style={{ fontFamily: "var(--font-pixel)", fontSize: 8, color: "#8C6551" }}
        >
          Find this again in Settings
        </p>
      </div>
    </div>
  );
}
