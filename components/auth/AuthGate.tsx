"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/authState";
import { LoginScreen } from "./LoginScreen";

/** Swaps the entire app out for LoginScreen while logged out -- mounted
 * once in the root layout so every route (not just Me) goes blank. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="flex flex-1 items-center justify-center min-h-dvh"
        style={{ backgroundColor: "var(--px-border)", color: "var(--px-white)", fontSize: 12 }}
      >
        LOADING...
      </div>
    );
  }

  return user ? <>{children}</> : <LoginScreen />;
}
