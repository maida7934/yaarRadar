"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/authState";
import { LoginScreen } from "./LoginScreen";
import { UsernameSetup } from "./UsernameSetup";
import { HowToUsePopup } from "@/components/ui/HowToUsePopup";
import { getMe } from "@/lib/api";
import { LocationGateProvider } from "@/lib/locationGate";

/** Reachable without a session. The password-recovery link arrives before
 * supabase-js has exchanged its fragment for one, so gating this route on
 * `user` would show the login screen instead -- and an expired link would
 * then give no hint as to why the reset silently did nothing. */
const PUBLIC_ROUTES = ["/reset-password"];

/** Swaps the entire app out for LoginScreen while logged out -- mounted once
 * in the root layout so every route (not just Me) goes blank.
 *
 * Also the gate for a first Google sign-in. OAuth never passes through the
 * backend's POST /auth/signup, so those accounts arrive with no username
 * while Search, Friends and the profile all key off one. `needsUsername`
 * checks the profile once per session and puts UsernameSetup in front of the
 * app until it's claimed. Email/password accounts always have one already,
 * so the check settles immediately and they never see it.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, accessToken, loading } = useAuth();
  const pathname = usePathname();

  // Stamped with the user it describes, so it invalidates itself when the
  // account changes rather than needing a reset write on logout (which would
  // be a synchronous setState inside the effect below).
  const [usernameCheck, setUsernameCheck] = useState<{ userId: string; needs: boolean } | null>(null);

  useEffect(() => {
    if (!accessToken || !user) return;
    let cancelled = false;
    getMe(accessToken)
      .then((profile) => {
        if (!cancelled) setUsernameCheck({ userId: user.id, needs: !profile.username });
      })
      .catch(() => {
        // A failed profile fetch is not proof an account needs onboarding --
        // it's far more often the backend being cold or unreachable. Sending
        // someone to "pick a username" on a network blip, when they already
        // have one, would be worse than letting them into the app; a real
        // missing username surfaces again on the next load.
        if (!cancelled) setUsernameCheck({ userId: user.id, needs: false });
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, user]);

  if (PUBLIC_ROUTES.includes(pathname)) return <>{children}</>;

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

  if (!user) return <LoginScreen />;

  // Only trust a result belonging to the account currently signed in.
  const needsUsername = usernameCheck?.userId === user.id && usernameCheck.needs;

  if (needsUsername && accessToken) {
    return (
      <UsernameSetup
        accessToken={accessToken}
        onDone={() => setUsernameCheck({ userId: user.id, needs: false })}
      />
    );
  }

  // HowToUsePopup lives here rather than in a page so it survives tab
  // navigation (this layout persists across route changes) and only ever
  // mounts once the user is actually logged in.
  //
  // The provider wraps both halves on purpose: the location question is
  // raised down in the Find scene (inside `children`) while the popup that
  // waits on it lives out here, so they need a shared place to meet.
  return (
    <LocationGateProvider>
      {children}
      <HowToUsePopup />
    </LocationGateProvider>
  );
}
