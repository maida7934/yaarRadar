"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { login as apiLogin, signup as apiSignup, type AuthResponse } from "./api";

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  /** True until the initial check for an already-persisted Supabase session
   * (e.g. from a previous visit) resolves -- avoids flashing the login
   * screen before we know whether one exists. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<void>;
  logOut: () => Promise<void>;
  /** Saves arbitrary profile fields (name, age, bio, ...) onto the account's
   * own Supabase Auth user record (auth.users.user_metadata) -- the backend
   * has no field for these (only username/character_id), and username can't
   * be changed at all, so this is the one place real per-account storage is
   * available without a backend change. See Me page's Edit Profile. */
  updateProfile: (data: Record<string, unknown>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
      setLoading(false);
    });

    // Keeps the token in sync as supabase-js auto-refreshes it, and picks
    // up sign-outs/sign-ins from setSession() below.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Hands the backend-issued session to supabase-js so it can auto-refresh
  // the token before it expires and so Realtime subscriptions become
  // RLS-aware -- see CLAUDE.md's auth flow. There's no /auth/refresh or
  // /auth/logout endpoint on the backend; token refresh and logout are
  // entirely supabase-js's job client-side.
  const applySession = async ({ session }: AuthResponse) => {
    const { data, error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) throw error;
    setUser(data.user);
    setAccessToken(data.session?.access_token ?? null);
  };

  const login = async (email: string, password: string) => {
    await applySession(await apiLogin(email, password));
  };

  const signup = async (email: string, password: string, username: string) => {
    await applySession(await apiSignup(email, password, username));
  };

  const logOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
  };

  const updateProfile = async (data: Record<string, unknown>) => {
    const { data: result, error } = await supabase.auth.updateUser({ data });
    if (error) throw error;
    setUser(result.user);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, signup, logOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
