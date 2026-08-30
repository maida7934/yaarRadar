"use client";

import { useState, type FormEvent } from "react";
import { ApiError, updateMe } from "@/lib/api";
import { NotchedFrame } from "@/components/ui/NotchedFrame";

/**
 * Shown once, after a first Google sign-in, to collect the one thing OAuth
 * cannot supply.
 *
 * Email/password signup goes through the backend's POST /auth/signup, which
 * takes a username and hands it to Supabase as user metadata for the trigger
 * that builds the profile row. OAuth skips that route entirely -- Google
 * returns a display name and an email, never a 3-20 character handle -- so
 * these accounts land with no usable username while search, friends and the
 * whole profile surface key off exactly that.
 *
 * Claiming it goes through PATCH /users/me, the same endpoint a rename uses.
 * Worth knowing: that endpoint enforces a 10-day rename cooldown, and this
 * first claim consumes the account's first rename. That is the backend's
 * rule, not something the UI can waive, so the copy says so rather than
 * letting it be a surprise ten days later.
 */
export function UsernameSetup({
  accessToken,
  onDone,
}: {
  accessToken: string;
  onDone: (username: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    // Mirrors the backend's own rule so an obvious miss is caught without a
    // round trip; the server is still the authority and its message wins.
    if (!/^[A-Za-z0-9_]{3,20}$/.test(trimmed)) {
      setError("3-20 characters, letters, numbers and underscores only.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const profile = await updateMe(accessToken, { username: trimmed });
      onDone(profile.username);
    } catch (err) {
      // "Username already taken" (409) and the format error both arrive
      // ready to show.
      setError(err instanceof ApiError ? err.message : "Could not save that. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 justify-center login-bg-web" style={{ backgroundColor: "var(--px-border)" }}>
      <div className="w-full max-w-md relative min-h-dvh flex flex-col items-center justify-center p-6 overflow-hidden">
        <div className="absolute inset-0 z-0 login-bg-phone" aria-hidden />

        <form onSubmit={submit} className="relative z-10 w-full p-5 flex flex-col gap-4">
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
            PICK A USERNAME
          </h1>

          <p style={{ fontFamily: "var(--font-pixel)", fontSize: 10, lineHeight: 1.7, color: "#6B4731" }}>
            This is how friends find you in Search. 3-20 characters, letters, numbers
            and underscores.
          </p>

          <input
            className="px-input login-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="yourname"
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            required
          />

          <p style={{ fontFamily: "var(--font-pixel)", fontSize: 8, color: "#8C6551" }}>
            You can change it later, but only once every 10 days -- so pick one you like.
          </p>

          {error && (
            <p className="text-[10px] font-bold" style={{ color: "var(--px-red)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "10px 14px",
              backgroundColor: "#bfc08e",
              border: "3px solid #8C6551",
              borderRadius: 10,
              fontFamily: "var(--font-pixel)",
              fontSize: 12,
              fontWeight: 700,
              color: "#5a4632",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "SAVING..." : "CLAIM IT"}
          </button>
        </form>
      </div>
    </div>
  );
}
