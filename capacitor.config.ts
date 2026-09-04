import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.yaarradar.mobile",
  appName: "YaarRadar",
  // Where `next build` with BUILD_TARGET=native leaves the exported site.
  // `cap sync` copies this into the Android project as the app's assets.
  webDir: "out",
  android: {
    // Debug APKs are sideloaded, not installed from Play, so they get no
    // trusted certificate. Without this the WebView refuses the backend's
    // https calls on some devices during local testing.
    allowMixedContent: true,
  },
  plugins: {
    // Asks at runtime; the manifest permissions are what actually grant it.
    Geolocation: {
      permissions: ["location"],
    },
  },
};

export default config;
