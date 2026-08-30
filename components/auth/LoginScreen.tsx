"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/authState";
import { ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { NotchedFrame } from "@/components/ui/NotchedFrame";
import { EyeIcon } from "@/components/ui/EyeIcon";

type Mode = "login" | "signup";

export function LoginScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  // Hands off to Google and comes back to the app root, where supabase-js
  // exchanges the fragment for a session (detectSessionInUrl) and AuthGate
  // takes it from there.
  //
  // Note this bypasses the backend's /auth/signup entirely, so a first-time
  // Google user arrives with no username -- Google supplies a name and an
  // email, not the 3-20 char handle everything here keys off. UsernameSetup
  // is what collects it afterwards; see AuthGate.
  //
  // Requires the Google provider to be enabled in the Supabase dashboard.
  // Until it is, Supabase answers with "Unsupported provider", which is
  // surfaced below rather than failing silently.
  const signInWithGoogle = async () => {
    setGoogleNotice(null);
    setGoogleSubmitting(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (oauthError) throw oauthError;
      // On success the browser is navigating away; leave the button
      // disabled rather than flickering back to its idle state.
    } catch (err) {
      setGoogleNotice(
        err instanceof Error && err.message
          ? err.message
          : "Could not start Google sign-in.",
      );
      setGoogleSubmitting(false);
    }
  };
  const [showPassword, setShowPassword] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  // Sends the recovery email for whatever's in the email field. redirectTo
  // is required: without it Supabase falls back to the project's Site URL,
  // which lands the user on the app root with a recovery fragment nothing
  // handles -- the link appears to do nothing at all.
  //
  // The notice is deliberately the same whether or not that address has an
  // account. Saying "no account with that email" would turn this box into a
  // way to test which addresses are registered.
  const sendReset = async () => {
    const address = email.trim();
    if (!address) {
      setError("Enter your email address first, then tap this again.");
      return;
    }
    setError(null);
    setResetSending(true);
    try {
      await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setResetNotice(`If ${address} has an account, a reset link is on its way.`);
    } catch {
      setResetNotice("Could not send the reset email. Try again in a moment.");
    } finally {
      setResetSending(false);
    }
  };

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
    // The wide art sits on this outer element so it spans the whole
    // viewport from md up, not just the centred phone column. Below md it's
    // background-image: none and the colour shows, exactly as before.
    <div className="flex flex-1 justify-center login-bg-web" style={{ backgroundColor: "var(--px-border)" }}>
      <div className="w-full max-w-md relative min-h-dvh flex flex-col items-center justify-center p-6 overflow-hidden">
        {/* Phone background -- portrait art, scoped to this app-width
            container, and switched off from md up where the wide art on the
            outer element takes over instead. Both live in globals.css
            (.login-bg-phone / .login-bg-web).

            Both files are the supplied art re-encoded at q=85 progressive,
            same pixel dimensions: login-bg.jpg from loginbg2.jpg (2.1 MB ->
            205 KB) and login-bg-web.jpg from loginbgweb.jpg (2.8 MB ->
            253 KB). The originals are near-lossless exports, which is a lot
            to push before a user can even log in, and at the sizes these
            actually render the difference isn't visible. The unoptimised
            originals are deliberately not committed; re-export at these
            sizes and quality to swap the art. */}
        <div className="absolute inset-0 z-0 login-bg-phone" aria-hidden />

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

            {mode === "login" && (
              <button
                type="button"
                onClick={sendReset}
                disabled={resetSending}
                className="text-left"
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 9,
                  color: "var(--px-muted)",
                  border: "none",
                  background: "none",
                  padding: 0,
                  textDecoration: "underline",
                  opacity: resetSending ? 0.5 : 1,
                }}
              >
                {resetSending ? "Sending..." : "Forgotten your password?"}
              </button>
            )}

            {resetNotice && (
              <p className="text-[10px]" style={{ color: "#365224" }}>{resetNotice}</p>
            )}

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
              onClick={signInWithGoogle}
              disabled={googleSubmitting}
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
              <p className="text-[10px] text-center" style={{ color: "var(--px-red)" }}>
                {googleNotice}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
