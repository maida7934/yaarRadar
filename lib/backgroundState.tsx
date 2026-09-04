"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const DEFAULT_BACKGROUND_ID = "/yaarRadar-assets/bg-wide.jpg";

interface BackgroundContextValue {
  backgroundId: string;
  setBackgroundId: (id: string) => void;
}

const BackgroundContext = createContext<BackgroundContextValue | null>(null);

function cacheKey() {
  return `yaarradar:backgroundId`;
}

function readCached(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(cacheKey());
  } catch {
    return null;
  }
}

function writeCached(backgroundId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(), backgroundId);
  } catch {}
}

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [backgroundId, setBackgroundIdState] = useState(
    () => readCached() ?? DEFAULT_BACKGROUND_ID,
  );

  const setBackgroundId = (id: string) => {
    setBackgroundIdState(id);
    writeCached(id);
  };

  return (
    <BackgroundContext.Provider value={{ backgroundId, setBackgroundId }}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackground() {
  const ctx = useContext(BackgroundContext);
  if (!ctx) throw new Error("useBackground must be used within BackgroundProvider");
  return ctx;
}
