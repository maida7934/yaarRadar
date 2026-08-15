"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/authState";
import { ApiError } from "@/lib/api";
import { NotchedFrame } from "@/components/ui/NotchedFrame";

type Mode = "login" | "signup";

/**
 * Shown in place of the whole app whenever there's no session (see
 * AuthGate). Real backend calls now -- POST /auth/login or /auth/signup
 * via lib/authState's login()/signup(), which also hands the session to
 * supabase-js (see CLAUDE.md's auth flow). Google isn't in the backend's
 * documented auth contract (email/password only), so that button doesn't
 * fake a login anymore -- it just says so.
 */
export function LoginScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleNotice, setGoogleNotice] = useState(false);

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
            image treatment. */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: "url(/pixelated-icons/bgs.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
          aria-hidden
        />

        <div className="relative z-10 w-full flex flex-col items-center gap-6">
          {/* Heading -- staircase double-outline notched frame (same
              NotchedFrame technique as the Me page's headings), not an
              image, so it stays crisp at any width. */}
          <div className="relative w-full flex items-center justify-center" style={{ height: 52 }}>
            <NotchedFrame colors={["var(--px-border)", "var(--px-white)", "#bfc08e"]} step={5} ringWidth={3} />
            <h1
              className="text-xl font-bold text-center tracking-widest"
              style={{ color: "#5a4632" }}
            >
              YAARRADAR
            </h1>
          </div>

          <form
            onSubmit={handleSubmit}
            className="relative w-full p-5 flex flex-col gap-4"
          >
            <NotchedFrame colors={["var(--px-border)", "#fdf1e5"]} step={5} ringWidth={4} />

            {/* Mode toggle -- simple single-outline notched box, same plain
                look as the Friends page's FRIENDS/VIEW REQUESTS container,
                just code-drawn instead of a cropped PNG. */}
            <div className="relative flex p-1" style={{ height: 40 }}>
              <NotchedFrame colors={["var(--px-border)", "#fdf1e5"]} step={4} ringWidth={3} />
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
              <input
                className="px-input login-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                minLength={6}
                required
              />
            </label>

            {error && (
              <p className="text-[10px] font-bold" style={{ color: "var(--px-red)" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="px-btn px-btn-dark w-full p-3" style={{ fontSize: 11 }}>
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
              style={{ fontSize: 11 }}
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
