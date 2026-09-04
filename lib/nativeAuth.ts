"use client";

import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabaseClient";

/**
 * Where an external browser sends the user back to. Claimed by the app in
 * AndroidManifest.xml -- change one and you must change the other, and it
 * must also be listed in Supabase's Authentication > URL Configuration >
 * Redirect URLs, or Supabase refuses to redirect here at all.
 */
export const NATIVE_REDIRECT_URL = "yaarradar://auth-callback";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Turns a redirect URL back into a session.
 *
 * Supabase returns tokens in the URL *fragment* (implicit flow, which is what
 * this project already uses on the web). On the web supabase-js reads that
 * itself via detectSessionInUrl -- but a deep link never touches the address
 * bar, so nothing parses it and the sign-in silently does nothing. Hence
 * doing it by hand here.
 *
 * Returns true if a session was established, so callers can tell "this link
 * was for us" from "some other yaarradar:// URL".
 */
export async function completeSessionFromUrl(url: string): Promise<boolean> {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return false;

  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return false;

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return !error;
}

/**
 * Listens for the app being reopened by a yaarradar:// link and finishes
 * whatever flow sent it -- Google sign-in or a password reset both land here.
 *
 * Also closes the in-app browser. Without that the user is left staring at a
 * blank tab over an app that has already signed them in.
 *
 * Returns a cleanup function; no-op off-device.
 */
export function listenForAuthDeepLinks(onSession?: () => void): () => void {
  if (!isNative()) return () => {};

  const handle = CapacitorApp.addListener("appUrlOpen", async ({ url }) => {
    const established = await completeSessionFromUrl(url);
    if (!established) return;
    await Browser.close().catch(() => {
      // Already dismissed, or the platform closed it for us.
    });
    onSession?.();
  });

  return () => {
    handle.then((h) => h.remove()).catch(() => {});
  };
}

/**
 * Google sign-in on device.
 *
 * `skipBrowserRedirect` matters: the default navigates the WebView itself to
 * Google, and Google refuses to render its consent screen inside an embedded
 * WebView (it blocks the whole class of them as a phishing risk, returning
 * "disallowed_useragent"). So we take the URL and hand it to the system
 * browser instead, which is both permitted and able to reuse an existing
 * Google session.
 */
export async function signInWithGoogleNative(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: NATIVE_REDIRECT_URL,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Google sign-in did not return a URL to open.");
  await Browser.open({ url: data.url });
}
