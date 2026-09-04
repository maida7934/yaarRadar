"use client";

import { registerPlugin } from "@capacitor/core";

/**
 * The Android background-location watcher, behind a typed wrapper.
 *
 * This is the reason the app ships as an APK at all. A browser tab is
 * suspended when the screen locks or the user switches away, which stops
 * watchPosition dead -- fatal for an app you use while walking with the
 * phone in a pocket. A foreground service keeps delivering fixes, and no
 * web build can do that at any price.
 *
 * registerPlugin rather than a static import of the package's own proxy, so
 * that importing this module is harmless on the web. The object exists
 * everywhere; only the calls fail off-device, and callers gate on
 * Capacitor.isNativePlatform() before making any.
 */
export interface NativeLocation {
  latitude: number;
  longitude: number;
  /** Metres, 95% confidence radius -- same meaning as the browser's. */
  accuracy: number;
  /** Degrees from true north, or null when standing still. Reported by the
   * device's own sensors, which is better than deriving it from consecutive
   * fixes, though the scene currently derives its own. */
  bearing: number | null;
  speed: number | null;
  time: number | null;
}

export interface NativeWatcherError {
  /** "NOT_AUTHORIZED" is the one worth handling: permission was refused, and
   * unlike a transient failure it will not fix itself. */
  code?: string;
  message: string;
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: {
      /** Body of the persistent notification. Android requires one while a
       * foreground service runs -- it is not suppressible, by design. */
      backgroundMessage?: string;
      backgroundTitle?: string;
      /** Let the plugin raise the system permission dialogs itself. */
      requestPermissions?: boolean;
      /** Whether to deliver a cached fix immediately on start. Off: a stale
       * position is exactly what makes a friend appear somewhere they left. */
      stale?: boolean;
      /** Metres of movement before another fix is delivered. */
      distanceFilter?: number;
    },
    callback: (position?: NativeLocation, error?: NativeWatcherError) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}

export const BackgroundGeolocation =
  registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
