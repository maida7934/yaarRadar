"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { NotchedFrame } from "@/components/ui/NotchedFrame";
import { EyeIcon } from "@/components/ui/EyeIcon";

/**
 * Where the "reset your password" email lands.
 *
 * Supabase puts the recovery tokens in the URL fragment, and supabase-js
 * (detectSessionInUrl defaults on) exchanges them for a session and fires
 * PASSWORD_RECOVERY. That session is real but narrow in intent: the user
 * proved they can read the mailbox, not that they know the old password,
 * so the only thing offered here is setting a new one.
 *
 * Both paths are handled because they race: the event fires if this page
 * mounts before supabase-js finishes the exchange, and getSession() covers
 * the case where it already finished before the listener was attached.
 * Waiting on only one of them hangs a good share of the time.
 *
 * AuthGate lets this route through unauthenticated (see its pathname
 * check) -- otherwise an expired link would show the login screen with no
 * explanation of why the reset did not work.
 */
type Status = "checking" | "ready" | "saving" | "done" | "invalid";

const BUTTON_STYLE: React.CSSProperties = {
  padding: "10px 14px",
  backgroundColor: "#bfc08e",
  border: "3px solid #8C6551",
  borderRadius: 10,
  fontFamily: "var(--font-pixel)",
  fontSize: 12,
  fontWeight: 700,
  color: "#5a4632",
};

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const accept = () => {
      if (settled) return;
      settled = true;
      setStatus("ready");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) accept();
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        accept();
        return;
      }
      // No session yet. The listener above may still fire while supabase-js
      // finishes exchanging the fragment, so give it a moment before
      // concluding the link is dead.
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        setStatus("invalid");
      }, 2500);
    });

    return () => {
      subscription.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords do not match.");
      return;
    }
    setStatus("saving");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      // Supabase's own wording is already user-facing here.
      setError(updateError.message);
      setStatus("ready");
      return;
    }
    setStatus("done");
  };

  return (
    <div className="flex flex-1 justify-center login-bg-web" style={{ backgroundColor: "var(--px-border)" }}>
      <div className="w-full max-w-md relative min-h-dvh flex flex-col items-center justify-center p-6 overflow-hidden">
        <div className="absolute inset-0 z-0 login-bg-phone" aria-hidden />

        <div className="relative z-10 w-full p-5 flex flex-col gap-4">
          <NotchedFrame colors={["#98755b", "#d4bbac", "#fdf1e5"]} step={5} ringWidth={4} />

          <h1
            className="text-center"
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: 15,
              fontWeight: 700,
              color: "#5a4632",
              letterSpacing: "0.06em",
            }}
          >
            SET A NEW PASSWORD
          </h1>

          {status === "checking" && (
            <p style={{ fontFamily: "var(--font-pixel)", fontSize: 10, color: "#6B4731", textAlign: "center" }}>
              Checking your reset link...
            </p>
          )}

          {status === "invalid" && (
            <>
              <p style={{ fontFamily: "var(--font-pixel)", fontSize: 10, lineHeight: 1.7, color: "#6B4731" }}>
                This reset link is not valid any more. They can only be used once, and they
                expire. Request a fresh one from the login screen.
              </p>
              <Link href="/" className="w-full text-center" style={BUTTON_STYLE}>
                BACK TO LOGIN
              </Link>
            </>
          )}

          {status === "done" && (
            <>
              <p style={{ fontFamily: "var(--font-pixel)", fontSize: 10, lineHeight: 1.7, color: "#365224" }}>
                Password updated, and you are signed in already.
              </p>
              <Link href="/" className="w-full text-center" style={BUTTON_STYLE}>
                CONTINUE
              </Link>
            </>
          )}

          {(status === "ready" || status === "saving") && (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>
                  NEW PASSWORD
                </span>
                <div className="relative flex items-center">
                  <input
                    className="px-input login-input w-full"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                    autoFocus
                    style={{ paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
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

              <label className="flex flex-col gap-1">
                <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>
                  CONFIRM NEW PASSWORD
                </span>
                <input
                  className="px-input login-input"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={6}
                  required
                />
              </label>

              {error && (
                <p className="text-[10px] font-bold" style={{ color: "var(--px-red)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "saving"}
                style={{ ...BUTTON_STYLE, opacity: status === "saving" ? 0.6 : 1 }}
              >
                {status === "saving" ? "SAVING..." : "SAVE PASSWORD"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
