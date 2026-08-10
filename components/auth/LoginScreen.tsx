"use client";

import { useState } from "react";
import { useAuth } from "@/lib/authState";

/**
 * Shown in place of the whole app whenever the mock session is logged out
 * (see the Me page's LOG OUT button / AuthGate). No backend is wired up
 * yet -- LOG IN and SIGN IN WITH GOOGLE both just flip the local mock
 * session back on, same level of "generic mocked interaction" as
 * everything else in the app right now.
 */
export function LoginScreen() {
  const { logIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex flex-1 justify-center" style={{ backgroundColor: "var(--px-border)" }}>
      <div className="w-full max-w-md relative min-h-dvh flex flex-col items-center justify-center p-6 overflow-hidden">
        {/* Same decorative road-texture background used on Friends/Search/Me */}
        <div className="absolute inset-0 z-0 px-bg-road" aria-hidden />

        <div className="relative z-10 w-full flex flex-col items-center gap-6">
          <h1
            className="text-2xl font-bold text-center"
            style={{ color: "var(--px-white)", textShadow: "3px 3px 0 var(--px-shadow)" }}
          >
            YAARRADAR
          </h1>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              logIn();
            }}
            className="w-full p-5 border-4 border-[var(--px-border)] shadow-[6px_6px_0_var(--px-shadow)] flex flex-col gap-4"
            style={{ backgroundColor: "var(--px-white)" }}
          >
            <h2 className="text-sm font-bold text-center" style={{ color: "var(--px-text)" }}>
              LOG IN
            </h2>

            <label className="flex flex-col gap-1">
              <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>EMAIL</span>
              <input
                className="px-input"
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
                className="px-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                required
              />
            </label>

            <button type="submit" className="px-btn px-btn-dark w-full p-3" style={{ fontSize: 11 }}>
              LOG IN
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-[3px]" style={{ backgroundColor: "var(--px-border)" }} />
              <span className="text-[10px]" style={{ color: "var(--px-muted)" }}>OR</span>
              <div className="flex-1 h-[3px]" style={{ backgroundColor: "var(--px-border)" }} />
            </div>

            <button type="button" onClick={logIn} className="px-btn px-btn-ghost w-full p-3" style={{ fontSize: 11 }}>
              SIGN IN WITH GOOGLE
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
