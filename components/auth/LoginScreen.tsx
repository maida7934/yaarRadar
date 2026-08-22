"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/authState";
import { ApiError } from "@/lib/api";
import { NotchedFrame } from "@/components/ui/NotchedFrame";

type Mode = "login" | "signup";

/** Pixel-drawn eye toggle, open or struck through. Built from a character
 * grid rather than SVG path outlines -- same technique as the Me page's
 * ProfileLeaf -- because a hand-written outline path for a 1px diagonal
 * self-intersects and renders as a broken staircase. One rect per pixel is
 * both easier to read and exactly what's intended. */
const EYE_GRID = [
  "................",
  "................",
  "................",
  "................",
  ".....oooooo.....",
  "...oowwwwwwoo...",
  "..owwwwiiwwwwo..",
  "..owwwiiiiwwwo..",
  "..owwwwiiwwwwo..",
  "...oowwwwwwoo...",
  ".....oooooo.....",
  "................",
  "................",
  "................",
  "................",
  "................",
];

/** Overlaid on EYE_GRID when the password is visible. `s` is a lighter
 * trailing pixel so the line stays readable where it crosses the dark iris. */
const SLASH_GRID = [
  "................",
  "................",
  "oo..............",
  "soo.............",
  ".soo............",
  "..soo...........",
  "...soo..........",
  "....soo.........",
  ".....soo........",
  "......soo.......",
  ".......soo......",
  "........soo.....",
  ".........soo....",
  "..........soo...",
  "...........so...",
  "................",
];

const EYE_COLORS: Record<string, string> = {
  o: "#6b403b", // lid / outline
  w: "#f3e8db", // sclera
  i: "#4a3826", // iris
  s: "#e6d9c8", // slash highlight
};

function gridRects(grid: string[], keyPrefix: string) {
  return grid.flatMap((row, y) =>
    row.split("").map((ch, x) =>
      ch === "." ? null : (
        <rect key={`${keyPrefix}-${x}-${y}`} x={x} y={y} width={1} height={1} fill={EYE_COLORS[ch]} />
      ),
    ),
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 16 16" shapeRendering="crispEdges" style={{ imageRendering: "pixelated" }} aria-hidden>
      {gridRects(EYE_GRID, "eye")}
      {open ? gridRects(SLASH_GRID, "slash") : null}
    </svg>
  );
}

export function LoginScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleNotice, setGoogleNotice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password, username);
      }
    } catch (err) {
      // Backend error messages are already human-readable (Supabase's own
      // auth error text, or class-validator's) -- see CLAUDE.md.
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 justify-center" style={{ backgroundColor: "var(--px-border)" }}>
      <div className="w-full max-w-md relative min-h-dvh flex flex-col items-center justify-center p-6 overflow-hidden">
        {/* Background image -- scoped to this app-width container (not the
            full browser viewport), same as the Friends/Me pages' background
            image treatment.

            login-bg.jpg is the supplied "loginbg2.jpg" re-encoded (q=85
            progressive, same 768x1376 pixels): the original is a 2.1 MB
            JPEG saved at near-lossless quality, which is a lot to push
            before a user can even log in. At the ~448px (max-w-md) width
            this container actually renders it, the two are visually
            indistinguishable. The unoptimised originals are deliberately not
            committed (~4 MB of source for one 205 KB asset in use); re-export
            at this size and quality to swap the art. */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: "url(/yaarRadar-assets/login-bg.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
          aria-hidden
        />

        <div className="relative z-10 w-full flex flex-col items-center gap-6">
          {/* Heading -- decorative pixel-art frame image (flowers/leaves at
              each end), aspect ratio preserved (~3:1) rather than forced
              into a fixed height, with the title overlaid centered on top. */}
          <div className="relative w-full">
            {/* Solid fill behind the frame's transparent interior -- same
                sage tone as the LOG IN button (.px-btn-dark's "#bfc08e"),
                so the heading reads as a filled bar instead of showing the
                page background through the gap. Clipped to the frame's own
                interior silhouette (traced from loginbox.png's alpha
                channel, including the pinch where the corner flowers dip
                inward) rather than a plain rectangle, so the fill never
                pokes out past the artwork's notched/rounded edges. */}
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: "#bfc08e",
                clipPath:
                  "polygon(8.75% 24.17%, 7.41% 28.31%, 6.08% 32.46%, 6.12% 38.67%, 7.41% 44.89%, 8.56% 49.03%, 8.01% 53.18%, 6.12% 59.39%, 6.12% 65.61%, 7.41% 69.75%, 8.75% 73.9%, 91.16% 73.9%, 92.5% 69.75%, 93.78% 65.61%, 93.78% 59.39%, 91.9% 53.18%, 91.39% 49.03%, 92.5% 44.89%, 93.78% 38.67%, 93.78% 32.46%, 92.5% 28.31%, 91.16% 24.17%)",
              }}
              aria-hidden
            />
            <img
              src="/pixelated-icons/loginbox.png"
              alt=""
              className="relative w-full h-auto block"
              style={{ imageRendering: "pixelated" }}
            />
            <h1
              className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-center tracking-widest"
              style={{ color: "#5a4632" }}
            >
              YAARRADAR
            </h1>
          </div>

          <form
            onSubmit={handleSubmit}
            className="relative w-full p-5 flex flex-col gap-4"
          >
            <NotchedFrame colors={["#98755b", "#d4bbac", "#fdf1e5"]} step={5} ringWidth={4} />

            {/* Mode toggle -- simple single-outline notched box, same plain
                look as the Friends page's FRIENDS/VIEW REQUESTS container,
                just code-drawn instead of a cropped PNG. */}
            <div className="relative flex p-1" style={{ height: 40 }}>
              <NotchedFrame colors={["#503828", "#fdf1e5"]} step={4} ringWidth={3} />
              <button
                type="button"
                className="flex-1 text-[11px] font-bold tracking-wide rounded-sm"
                style={{
                  fontFamily: "var(--font-pixel)",
                  color: mode === "login" ? "#ffffff" : "var(--px-text)",
                  backgroundColor: mode === "login" ? "#706760" : "transparent",
                }}
                onClick={() => switchMode("login")}
              >
                LOG IN
              </button>
              <button
                type="button"
                className="flex-1 text-[11px] font-bold tracking-wide rounded-sm"
                style={{
                  fontFamily: "var(--font-pixel)",
                  color: mode === "signup" ? "#ffffff" : "var(--px-text)",
                  backgroundColor: mode === "signup" ? "#706760" : "transparent",
                }}
                onClick={() => switchMode("signup")}
              >
                SIGN UP
              </button>
            </div>

            {mode === "signup" && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>USERNAME</span>
                <input
                  className="px-input login-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="letters, numbers, underscore"
                  pattern="[A-Za-z0-9_]{3,20}"
                  title="3-20 characters: letters, numbers, underscore"
                  required
                />
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>EMAIL</span>
              <input
                className="px-input login-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>PASSWORD</span>
              {/* Reveal toggle -- sits inside the field's right edge. The
                  input keeps its own padding via paddingRight so typed
                  characters never run underneath the button. */}
              <div className="relative flex items-center">
                <input
                  className="px-input login-input w-full"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  minLength={6}
                  required
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  // Not a submit button, and deliberately out of the tab
                  // order -- tabbing from password should reach the submit
                  // button, not a decorative toggle.
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2 flex items-center justify-center"
                  style={{ width: 28, height: 28, border: "none", background: "none", padding: 0 }}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </label>

            {error && (
              <p className="text-[10px] font-bold" style={{ color: "var(--px-red)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="px-btn px-btn-dark w-full p-3"
              style={{
                fontSize: 11,
                borderRadius: 14,
                borderColor: "#503828",
                boxShadow: "4px 4px 0 #503828, inset -3px -4px 0 rgba(0,0,0,0.25), inset 2px 2px 0 rgba(255,255,255,0.35)",
              }}
            >
              {submitting ? "..." : mode === "login" ? "LOG IN" : "SIGN UP"}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-[3px]" style={{ backgroundColor: "var(--px-border)" }} />
              <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>OR</span>
              <div className="flex-1 h-[3px]" style={{ backgroundColor: "var(--px-border)" }} />
            </div>

            <button
              type="button"
              onClick={() => setGoogleNotice(true)}
              className="px-btn px-btn-ghost w-full p-3"
              style={{
                fontSize: 11,
                borderRadius: 14,
                borderColor: "#503828",
                boxShadow: "4px 4px 0 #503828, inset -3px -4px 0 rgba(0,0,0,0.25), inset 2px 2px 0 rgba(255,255,255,0.35)",
              }}
            >
              SIGN IN WITH GOOGLE
            </button>
            {googleNotice && (
              <p className="text-[10px] text-center" style={{ color: "var(--px-muted)" }}>
                Google sign-in isn&apos;t set up yet.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
