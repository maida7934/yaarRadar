"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_CHARACTER_ID } from "@/components/scene/spriteSets";
import { useAuth } from "./authState";
import { getMe, updateMe } from "./api";

interface CharacterContextValue {
  characterId: string;
  /** True until the initial GET /users/me resolves -- avoids briefly
   * flashing the default character before the real pick loads in. */
  loading: boolean;
  setCharacterId: (id: string) => Promise<void>;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

/** Backs the Me page's character picker with the real PATCH /users/me
 * field, and loads whatever was last picked via GET /users/me on login --
 * so the choice shows up correctly on every page (Home's "You" included)
 * and survives coming back later, instead of resetting to the mock
 * default every time. Mounted inside AuthGate, so accessToken is always
 * set once this renders. */
export function CharacterProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const [characterId, setCharacterIdState] = useState(DEFAULT_CHARACTER_ID);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    getMe(accessToken)
      .then((profile) => {
        if (!cancelled) setCharacterIdState(profile.character_id ?? DEFAULT_CHARACTER_ID);
      })
      .catch(() => {
        // Leave the default selected -- the picker still works locally
        // even if this initial fetch fails.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const setCharacterId = async (id: string) => {
    const previous = characterId;
    setCharacterIdState(id); // optimistic -- picker feels instant
    if (!accessToken) return;
    try {
      await updateMe(accessToken, id);
    } catch (err) {
      setCharacterIdState(previous); // revert if the backend rejected it
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
