"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Local-only mock session flag -- no backend/Supabase auth wired up yet
// (see CLAUDE.md's auth flow for the real plan). Defaults to logged in so
// every existing page behaves exactly as before; logging out from the Me
// page is currently the only way to see the logged-out state.
interface AuthContextValue {
  loggedIn: boolean;
  logIn: () => void;
  logOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(true);

  return (
    <AuthContext.Provider value={{ loggedIn, logIn: () => setLoggedIn(true), logOut: () => setLoggedIn(false) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
