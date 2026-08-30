"use client";

import { NotchedFrame } from "@/components/ui/NotchedFrame";

/**
 * Asked once, up front, before the browser's own geolocation prompt.
 *
 * This exists because a browser denial is permanent from the page's side:
 * dismiss it once and every later request fails instantly, with only
 * browser settings able to undo it. So the expensive mistake is firing the
 * real prompt at someone who doesn't yet know why the app wants their
 * location -- they say no, and the app is bricked for them until they go
 * digging through site settings.
 *
 * Hence a plain explanation first, and the real prompt only from the button.
 * Keeping it behind a tap also keeps it inside a user gesture, which is the
 * reliable way to get the prompt to appear at all -- Safari in particular is
 * unreliable about prompts that fire on load with no interaction behind them.
 *
 * "NOT NOW" deliberately doesn't trigger anything: no browser prompt, no
 * denial recorded, and the location toggle still works later. Declining here
 * costs the user nothing.
 */
export function LocationPrimer({
  onEnable,
  onDismiss,
}: {
  onEnable: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Turn on location"
    >
      <div className="relative w-full max-w-sm p-5 flex flex-col gap-3">
        <NotchedFrame colors={["#98755b", "#d4bbac", "#fdf1e5"]} step={5} ringWidth={4} />

        <h2
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 14,
            fontWeight: 700,
            color: "#5a4632",
            letterSpacing: "0.06em",
          }}
        >
          TURN ON LOCATION
        </h2>

        <p style={{ fontFamily: "var(--font-pixel)", fontSize: 10, lineHeight: 1.75, color: "#6B4731" }}>
          YaarRadar needs your location to show how far away your friend is and
          which way to walk. Only friends you have confirmed can ever see it, and
          you can switch it off any time.
        </p>

        <p style={{ fontFamily: "var(--font-pixel)", fontSize: 9, lineHeight: 1.7, color: "#8C6551" }}>
          Your browser will ask next. If you say no there, it stops asking -- you
          would have to re-allow it in browser settings.
        </p>

        <button
          type="button"
          onClick={onEnable}
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
          ENABLE LOCATION
        </button>

        <button
          type="button"
          onClick={onDismiss}
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 9,
            color: "#8C6551",
            border: "none",
            background: "none",
            textDecoration: "underline",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
