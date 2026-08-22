// Thin fetch wrapper around the NestJS backend -- see CLAUDE.md's "Backend
// API reference" for the full contract. Every route except /auth/* needs
// the caller's access token attached as `Authorization: Bearer <token>`.
// This is the *only* way app data is read/written -- no direct Supabase
// `.from(...)` calls, per the project's hard rule.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, accessToken: string | null, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    // fetch() throws (rather than resolving with an error status) when the
    // request never reached a server at all -- backend not running, wrong
    // URL, CORS blocked, offline. Surfaced as an ApiError too (status 0)
    // so callers don't need a separate catch branch, but with a message
    // that says what's actually wrong instead of a vague catch-all.
    throw new ApiError(`Could not reach the server at ${API_BASE_URL}. Is the backend running?`, 0);
  }

  // 200 with an empty body (e.g. DELETE /friends/:friendId) has nothing to parse.
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    // Backend error messages are already human-readable (Supabase's own
    // auth error text, or class-validator's), including for array-shaped
    // validation errors -- see CLAUDE.md.
    const message = Array.isArray(body?.message) ? body.message.join(", ") : (body?.message ?? res.statusText);
    throw new ApiError(message, res.status);
  }

  return body as T;
}

// ── Auth (src/auth/) -- no access token needed ──────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  [key: string]: unknown;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
}

export interface AuthResponse {
  user: AuthUser;
  session: AuthSession;
}

export function signup(email: string, password: string, username: string) {
  return request<AuthResponse>("/auth/signup", null, {
    method: "POST",
    body: JSON.stringify({ email, password, username }),
  });
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/auth/login", null, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ── Users (src/users/) ───────────────────────────────────────────────────

export interface UserSearchResult {
  id: string;
  username: string;
  character_id?: string | null;
  bio?: string | null;
}

export interface Profile {
  id: string;
  username: string;
  character_id: string | null;
  /** null = never renamed since signup (so no cooldown is running yet);
   * otherwise the ISO timestamp of the last actual rename, which the
   * 10-day rename cooldown is measured from. Returned by both GET and
   * PATCH /users/me. */
  username_changed_at: string | null;
  bio?: string | null;
  created_at: string;
}

export function searchUsers(accessToken: string, q: string) {
  return request<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(q)}`, accessToken);
}

export function getMe(accessToken: string) {
  return request<Profile>("/users/me", accessToken);
}

/** Both `characterId` and `username` are optional and independent -- send
 * either alone or both together. Renaming is rate-limited server-side to
 * once every 10 days and rejects regardless of what the UI allows: a
 * too-soon rename comes back 400 "You can change your username again in N
 * days", a clash 409 "Username already taken", and a malformed one (not
 * 3-20 chars of letters/numbers/underscore) 400. All three arrive already
 * phrased for display, so callers should show ApiError.message as-is
 * rather than substituting their own wording. */
export function updateMe(accessToken: string, updates: { characterId?: string; username?: string; bio?: string }) {
  return request<Profile>("/users/me", accessToken, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// ── Friends (src/friends/) ───────────────────────────────────────────────

// The other party in the request (sender if you're the receiver, or vice
// versa) -- confirmed live: GET /friends/requests nests this rather than
// putting character_id/bio flat on the row, and conveniently includes
// username too, so a request no longer needs the local userDirectory
// cache guess to show who it's from.
export interface RequestOtherUser {
  id: string;
  username: string;
  character_id: string | null;
  bio: string | null;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  other_user?: RequestOtherUser;
}

export interface Friend {
  id: string;
  username: string;
  character_id: string | null;
  bio?: string | null;
  // Not sent by the backend yet -- undefined until that lands, so callers
  // should treat missing/undefined as "assume online" rather than offline.
  is_online?: boolean;
}

export function sendFriendRequest(accessToken: string, receiverId: string) {
  return request<FriendRequest>("/friends/requests", accessToken, {
    method: "POST",
    body: JSON.stringify({ receiverId }),
  });
}

export function getFriendRequests(accessToken: string) {
  return request<FriendRequest[]>("/friends/requests", accessToken);
}

export function cancelFriendRequest(accessToken: string, id: string) {
  return request<null>(`/friends/requests/${id}`, accessToken, { method: "DELETE" });
}

export function acceptFriendRequest(accessToken: string, id: string) {
  return request<FriendRequest>(`/friends/requests/${id}/accept`, accessToken, { method: "POST" });
}

export function declineFriendRequest(accessToken: string, id: string) {
  return request<FriendRequest>(`/friends/requests/${id}/decline`, accessToken, { method: "POST" });
}

export function getFriends(accessToken: string) {
  return request<Friend[]>("/friends", accessToken);
}

export function unfriend(accessToken: string, friendId: string) {
  return request<null>(`/friends/${friendId}`, accessToken, { method: "DELETE" });
}

// ── Invites (src/friends/invites.*) ──────────────────────────────────────

export interface Invite {
  token: string;
  inviter_id: string;
  created_at: string;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
}

export function createInvite(accessToken: string) {
  return request<Invite>("/invites", accessToken, { method: "POST" });
}

export function redeemInvite(accessToken: string, token: string) {
  return request<{ inviterId: string }>(`/invites/${token}/redeem`, accessToken, { method: "POST" });
}

// ── Locations (src/locations/) ───────────────────────────────────────────

export interface LocationPoint {
  user_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
}

export function pushLocation(accessToken: string, latitude: number, longitude: number) {
  return request<LocationPoint>("/locations", accessToken, {
    method: "POST",
    body: JSON.stringify({ latitude, longitude }),
  });
}

export function getLocations(accessToken: string, userIds: string[]) {
  return request<LocationPoint[]>(`/locations?userIds=${userIds.join(",")}`, accessToken);
}
