"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/authState";
import { LoginScreen } from "./LoginScreen";

/** Swaps the entire app out for LoginScreen while logged out -- mounted
 * once in the root layout so every route (not just Me) goes blank. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { loggedIn } = useAuth();
  return loggedIn ? <>{children}</> : <LoginScreen />;
}
