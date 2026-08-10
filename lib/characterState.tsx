"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_CHARACTER_ID } from "@/components/scene/spriteSets";
import { useAuth } from "./authState";
import { getMe, updateMe } from "./api";

interface CharacterContextValue {
  characterId: string;
  /** True only when there's nothing cached yet for this account on this
   * browser (a first-ever login here) and GET /users/me hasn't resolved --
   * see the caching below for why this is rare, and Me page for the
   * last-resort placeholder shown while it's true. */
  loading: boolean;
  setCharacterId: (id: string) => Promise<void>;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

// Per-account (not just per-browser) so a different login on the same
// browser doesn't briefly show the previous account's cached pick.
function cacheKey(userId: string) {
  return `yaarradar:characterId:${userId}`;
}

function readCached(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(cacheKey(userId));
  } catch {
    return null;
  }
}

function writeCached(userId: string, characterId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(userId), characterId);
  } catch {
    // Private browsing, storage full, etc. -- fine, just no instant-load
    // next time; GET /users/me still covers it.
  }
}

/** Backs the Me page's character picker with the real PATCH /users/me
 * field, and loads whatever was last picked via GET /users/me on login --
 * so the choice shows up correctly on every page (Home's "You" included)
 * and survives coming back later, instead of resetting to the mock
 * default every time. Mounted inside AuthGate, so accessToken is always
 * set once this renders.
 *
 * Seeded from a local cache of the last-known value for this account, so a
 * returning login shows the right character immediately instead of the
 * default sprite while GET /users/me is still in flight -- that round trip
 * was showing up as a visible flash/delay on the Me page's avatar. */
export function CharacterProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const userId = user?.id ?? null;

  const [characterId, setCharacterIdState] = useState(
    () => (userId ? readCached(userId) : null) ?? DEFAULT_CHARACTER_ID,
  );
  const [loading, setLoading] = useState(() => (userId ? readCached(userId) === null : true));

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    getMe(accessToken)
      .then((profile) => {
        if (cancelled) return;
        const real = profile.character_id ?? DEFAULT_CHARACTER_ID;
        setCharacterIdState(real);
        if (userId) writeCached(userId, real);
      })
      .catch(() => {
        // Leave whatever's currently shown (cached or default) -- the
        // picker still works locally even if this fetch fails.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, userId]);

  const setCharacterId = async (id: string) => {
    const previous = characterId;
    setCharacterIdState(id); // optimistic -- picker feels instant
    if (userId) writeCached(userId, id);
    if (!accessToken) return;
    try {
      await updateMe(accessToken, id);
    } catch (err) {
      setCharacterIdState(previous); // revert if the backend rejected it
      if (userId) writeCached(userId, previous);
      throw err;
    }
  };

  return (
    <CharacterContext.Provider value={{ characterId, loading, setCharacterId }}>
      {children}
    </CharacterContext.Provider>
  );
}

export function useCharacter() {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error("useCharacter must be used within CharacterProvider");
  return ctx;
}
