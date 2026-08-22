"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/authState";
import { LoginScreen } from "./LoginScreen";
import { HowToUsePopup } from "@/components/ui/HowToUsePopup";

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

  // HowToUsePopup lives here rather than in a page so it survives tab
  // navigation (this layout persists across route changes) and only ever
  // mounts once the user is actually logged in.
  return user ? (
    <>
      {children}
      <HowToUsePopup />
    </>
  ) : (
    <LoginScreen />
  );
}
