import type { NextConfig } from "next";

// The Android build is the same app, served from files inside the APK rather
// than from a server -- so it needs `output: "export"` (plain HTML/JS on
// disk, which is what Capacitor copies into the native project).
//
// Gated behind an env var rather than switched on permanently: a static
// export is a real downgrade for the web deploy, since it rules out ever
// adding an API route, middleware or a server action. Vercel keeps building
// exactly as before; only `npm run build:native` takes this branch.
const isNativeBuild = process.env.BUILD_TARGET === "native";

// A native build bakes NEXT_PUBLIC_* in at compile time -- there is no
// server to re-read them later, and no way to change them without shipping a
// new APK. `localhost` is the trap: it's the right value for web development
// and a silently fatal one on a phone, where it resolves to the handset
// itself. The APK would install, launch, and fail every request with no
// obvious cause. Cleartext http is the same story -- Android blocks it by
// default, so the failure looks like a dead backend rather than a config
// mistake. Fail the build instead of shipping either.
if (isNativeBuild) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(apiBase);
  if (!apiBase) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set. A native build needs the deployed backend URL, " +
        "e.g. cross-env BUILD_TARGET=native NEXT_PUBLIC_API_BASE_URL=https://your-backend.vercel.app next build",
    );
  }
  if (isLoopback) {
    throw new Error(
      `NEXT_PUBLIC_API_BASE_URL is "${apiBase}". Inside an APK, localhost is the phone itself, ` +
        "so the app could never reach your backend. Set it to the deployed https:// URL for native builds.",
    );
  }
  if (!apiBase.startsWith("https://")) {
    throw new Error(
      `NEXT_PUBLIC_API_BASE_URL is "${apiBase}". Android blocks cleartext http by default, ` +
        "so this would fail at runtime. Use the https:// URL.",
    );
  }
}

const nextConfig: NextConfig = isNativeBuild
  ? {
      output: "export",
      // No Next image server inside an APK. Harmless today -- everything
      // uses plain <img> -- but it would fail the export the moment someone
      // reached for next/image.
      images: { unoptimized: true },
      // Export writes index.html per route; folder-style URLs are what a
      // WebView resolves reliably from the filesystem.
      trailingSlash: true,
    }
  : {};

export default nextConfig;
