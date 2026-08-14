// Best-effort local cache of user id -> username, built up from search
// results. Exists because GET /friends/requests only returns sender_id/
// receiver_id (raw ids) -- there's no backend endpoint to resolve an
// arbitrary user id back to a username, confirmed against the live API
// (see app/friends/page.tsx). So an incoming request can only show a real
// name if you'd searched that person before -- otherwise it falls back to
// "Unknown user". Global (not per-account): usernames are public/
// searchable already, so there's no privacy reason to scope this.
const STORAGE_KEY = "yaarradar:knownUsers";

interface KnownUser {
  username: string;
  characterId: string | null;
  bio?: string | null;
}

function readAll(): Record<string, KnownUser | string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function rememberUser(id: string, username: string, characterId: string | null = null, bio: string | null = null) {
  if (typeof window === "undefined") return;
  try {
    const all = readAll();
    // Preserve existing characterId/bio if we only got username this time
    const existing = all[id];
    let newCharacterId = characterId;
    let newBio = bio;
    if (existing && typeof existing === "object") {
      if (!newCharacterId) newCharacterId = existing.characterId;
      if (newBio === null) newBio = existing.bio ?? null;
    }
    all[id] = { username, characterId: newCharacterId, bio: newBio };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Private browsing, storage full, etc. -- fine, just means this
    // particular id won't resolve later.
  }
}

export function lookupUser(id: string): KnownUser | null {
  const data = readAll()[id];
  if (!data) return null;
  if (typeof data === "string") return { username: data, characterId: null };
  return data as KnownUser;
}

export function lookupUsername(id: string): string | null {
  return lookupUser(id)?.username ?? null;
}
