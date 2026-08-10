// Best-effort local cache of user id -> username, built up from search
// results. Exists because GET /friends/requests only returns sender_id/
// receiver_id (raw ids) -- there's no backend endpoint to resolve an
// arbitrary user id back to a username, confirmed against the live API
// (see app/friends/page.tsx). So an incoming request can only show a real
// name if you'd searched that person before -- otherwise it falls back to
// "Unknown user". Global (not per-account): usernames are public/
// searchable already, so there's no privacy reason to scope this.
const STORAGE_KEY = "yaarradar:knownUsers";

function readAll(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function rememberUser(id: string, username: string) {
  if (typeof window === "undefined") return;
  try {
    const all = readAll();
    all[id] = username;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Private browsing, storage full, etc. -- fine, just means this
    // particular id won't resolve later.
  }
}

export function lookupUsername(id: string): string | null {
  return readAll()[id] ?? null;
}
