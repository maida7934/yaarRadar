# walk — frontend (Next.js PWA)

## What this is
The frontend for **walk**, a "Find My Friends" style app: two people see their
straight-line distance and compass bearing to each other in real time, shown as
two animated sprite characters walking toward each other on a road, closing the
gap as they get closer — not turn-by-turn navigation, just "they're 40m that way."

This repo is **frontend only**. All data lives behind a separate NestJS backend
repo, local sibling folder `walk/` (i.e. `../walk` from this repo), which itself
sits in front of Supabase (Postgres + Auth + Realtime). This document is the
complete contract between the two — read it fully before writing any code that
touches auth, friends, locations, or the database in any way. Cross-checked
against the actual backend source (2026-08-08): every route, DTO shape, and
response field documented below matches `walk/src/**` exactly — no drift as of
this writing.

## The one hard rule: no direct database access
**This app never queries or writes Supabase tables directly.** Every read and
every write of application data — signup, login, searching users, sending/
accepting/declining friend requests, invites, listing friends, unfriending,
pushing your own location, reading a friend's location — goes through the
NestJS backend's REST API over plain HTTPS with a `Authorization: Bearer
<token>` header. No `@supabase/supabase-js` `.from(...)` calls anywhere in this
codebase, ever.

**The one narrow exception** (already an established part of the backend's
architecture, not a frontend decision): live push of a friend's location update
happens via **Supabase Realtime**, subscribed to directly from the browser. The
backend has no persistent WebSocket/SSE gateway of its own — it's a stateless
REST API — so Realtime is Supabase's job, not the backend's. This is still not
"direct database access" in the dangerous sense:
- It's **read-only** — the frontend never writes through this channel.
- It's still governed by the exact same Postgres RLS policies as the REST API
  (a user can only receive Realtime updates for rows they're allowed to `SELECT`
  under RLS — their own row, or a friend's).
- To make RLS apply to the Realtime connection, the Supabase client must be
  authenticated with the same session the backend handed back at login (see
  below) via `supabase.auth.setSession(...)` — never just the bare anon key
  with no session, and never a service-role key (one doesn't exist in this
  project — see backend `CLAUDE.md`, "$0, no card on file anywhere").

Concretely: use `@supabase/supabase-js` client-side for exactly two things —
(1) holding/refreshing the session obtained from the backend's login response,
and (2) subscribing to `postgres_changes` on the `locations` table for live
updates. Do not call `.from()` on it for anything else. Everything else is a
`fetch`/API-client call to the backend.

## Tech stack
| Piece | Choice | Why |
|---|---|---|
| Framework | Next.js (TypeScript, App Router) | |
| Backend | This repo's own NestJS API (see "Backend API reference" below) — **never** Supabase directly, except the Realtime exception above | |
| Location | `navigator.geolocation` (`watchPosition`) | Browser built-in, no dependency |
| Live friend location push | Supabase Realtime, subscribed client-side, RLS-scoped (see above) | Matches backend's existing architecture — no WebSocket gateway to build |
| Sprite / character animation | **GSAP** for the walk-cycle itself (frame-stepping a sprite sheet via a stepped timeline — GSAP's `steps()` easing or a `gsap.timeline()` driving `background-position`/frame index is the standard way to do sprite-sheet animation smoothly), **Framer Motion** for everything positional/layout (moving each character along the road, scaling/fading UI, page/section transitions) | Both are fully free (GSAP's paid plugins became free in 2025 under Webflow); splitting "walk cycle" (GSAP) from "where on screen" (Framer Motion, React-declarative, reacts cleanly to state changes) avoids fighting one library into the other's job |
| Maps (later phase only, not needed for the sprite MVP) | Leaflet + OpenStreetMap tiles | **Not** Mapbox/Google Maps — both require a card on file even at $0 usage; Leaflet+OSM doesn't |
| PWA | Web app manifest + service worker (`next-pwa` or hand-rolled) | Installable to home screen |
| State | React Context, or Zustand if Context gets unwieldy | Session token, selected friend(s) to view, live coordinates |
| Styling/animation partner note | Avoid pulling in a canvas engine (Pixi.js, etc.) unless the plain CSS-sprite-sheet + GSAP approach proves insufficient once real assets are in — start simple | |

## Env vars (`.env.local`, not committed)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000   # the NestJS backend; swap for its deployed URL later
NEXT_PUBLIC_SUPABASE_URL=                         # same Supabase project as the backend
NEXT_PUBLIC_SUPABASE_ANON_KEY=                    # anon key — safe to expose client-side, RLS still applies
```
`NEXT_PUBLIC_` is required here (unlike the backend's `.env.local`) because this
is a browser app — the API base URL and Supabase anon key both need to reach
client-side code. The anon key alone grants nothing without a session; RLS does
the real gatekeeping.

## Auth flow
1. `POST /auth/signup` or `POST /auth/login` (bodies below) →  backend returns
   `{ user, session }` where `session` is a **raw Supabase session object**
   (`access_token`, `refresh_token`, `expires_in`, `expires_at`, `token_type`).
2. Store `session.access_token` and attach it as `Authorization: Bearer
   <access_token>` on every subsequent backend API call.
3. Also hand the whole `session` to the client-side Supabase client via
   `supabase.auth.setSession({ access_token, refresh_token })`. This does two
   things: lets `supabase-js` auto-refresh the token before it expires (listen
   via `supabase.auth.onAuthStateChange` and re-sync whatever you're using for
   the `Authorization` header), and makes the Realtime subscription RLS-aware.
4. **There is no `/auth/refresh` or `/auth/logout` endpoint on the backend.**
   Token refresh is handled entirely client-side through `supabase-js`'s own
   session management (step 3). Logout is just clearing local session state —
   optionally call `supabase.auth.signOut()` to also invalidate the Supabase
   session, but that's a client-side-only call, not a backend endpoint.
5. Tokens expire in `expires_in` seconds (3600 = 1hr) — don't assume they're
   long-lived; wire up the refresh listener from day one rather than bolting it
   on later.

## Backend API reference
Base URL: `NEXT_PUBLIC_API_BASE_URL`. No route prefix (e.g. no `/api/v1`) — routes
are exactly as listed. All routes except `/auth/*` require `Authorization:
Bearer <access_token>` and return `401` if missing/invalid/expired. Request
bodies are validated (`class-validator`, whitelist + transform) — extra fields
are stripped, invalid fields `400`.

### Auth — `src/auth/`
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/signup` | `{ email, password (min 6), username (3-20 chars: letters/numbers/underscore only, must be unique) }` | `{ user, session }` |
| POST | `/auth/login` | `{ email, password }` | `{ user, session }` |

`username` uniqueness is enforced atomically by a Postgres trigger on
`auth.users` insert — a taken username fails the whole signup call (the DB
transaction rolls back), so a `400` here can mean either a bad email/password
shape or a taken username; surface the backend's error message to the user,
it's already human-readable (Supabase's own auth error text).

### Users — `src/users/` (search, profile)
| Method | Path | Body/Query | Response | Notes |
|---|---|---|---|---|
| GET | `/users/search?q=` | `q` (non-empty string, fuzzy/substring match, case-insensitive, whitespace stripped) | `[{ id, username }]` | Excludes yourself, capped at 20 results |
| GET | `/users/me` | — | `{ id, username, character_id, created_at }` | Your own `profiles` row. `character_id` is `null` until you've picked one |
| PATCH | `/users/me` | `{ characterId: string }` (1-50 chars) | the updated row, same shape as `GET /users/me` | The **only** editable profile field — `username` cannot be changed through this or any endpoint, it's locked in at signup. Backed by a Postgres RLS policy scoped to just this one column, so even a request that somehow bypassed this endpoint couldn't touch `username` |

### Friends — `src/friends/`
| Method | Path | Body/Param | Response | Notes |
|---|---|---|---|---|
| POST | `/friends/requests` | `{ receiverId: uuid }` | the created request row (`id, sender_id, receiver_id, status: "pending", created_at`) | `409` if a request between this pair already exists in either direction (unique constraint) |
| GET | `/friends/requests` | — | all request rows you're sender or receiver of, any status | Filter client-side by `status`/direction for "incoming" vs "sent" |
| POST | `/friends/requests/:id/accept` | `id` = request id | the request row, `status: "accepted"` | Also creates the mutual `friends` pairing server-side |
| POST | `/friends/requests/:id/decline` | `id` = request id | the request row, `status: "declined"` | |
| GET | `/friends` | — | `[{ id, username, character_id }]` — your confirmed friends | Use this to populate the friend picker; `character_id` tells you which sprite to render for them in the scene (may be `null` if they haven't picked one yet — fall back to a default sprite) |
| DELETE | `/friends/:friendId` | `friendId` = the friend's user id | `200`, empty body | **Unfriends mutually** — neither side can see the other's location afterward. Also clears the old request history between the pair, so a fresh request can be sent and accepted again later without erroring |

### Invites — `src/friends/invites.*`
| Method | Path | Body/Param | Response | Notes |
|---|---|---|---|---|
| POST | `/invites` | — | `{ token, inviter_id, created_at, expires_at, used_by: null, used_at: null }` | Token expires in 7 days. Turning this into a shareable link/QR and calling `navigator.share()` is frontend-only, no backend involvement |
| POST | `/invites/:token/redeem` | `token` in path | `{ inviterId }` | `404` unknown token, `400` already used or expired. Creates the mutual `friends` pairing server-side, same as accepting a request |

### Locations — `src/locations/`
| Method | Path | Body/Query | Response | Notes |
|---|---|---|---|---|
| POST | `/locations` | `{ latitude, longitude }` (validated as real lat/lng ranges) | the upserted row (`id, user_id, latitude, longitude, updated_at`) | Upsert — same row overwritten every call, no history kept. Call this on an interval from `watchPosition`, not on every single GPS event |
| GET | `/locations?userIds=a,b,c` | comma-separated UUIDs | `[{ user_id, latitude, longitude, updated_at }]` | **Silently omits** any id that isn't a confirmed friend (RLS filters it out — no error, just a shorter array) or that hasn't pushed a location yet. Never assume the response array is the same length as the request |

## Realtime subscription (the one direct-Supabase piece)
After `setSession` (see Auth flow), subscribe like:
```ts
supabase
  .channel("locations-changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "locations" },
    (payload) => { /* update local state for payload.new.user_id if it's a friend you're viewing */ }
  )
  .subscribe();
```
RLS scopes what rows you actually receive events for — you'll only get change
events for your own row and rows belonging to confirmed friends, same as the
`GET /locations` filtering. Still, filter client-side to the specific friend
id(s) currently being viewed (the "Find" screen only shows up to 2 at once —
that cap is frontend-only, not a backend permission gate, so don't rely on the
backend to enforce it).

## Distance & bearing math
Two people's GPS coordinates → straight-line distance (meters) and initial
compass bearing (degrees, 0 = north, clockwise). Pure functions, unit-test
with known coordinate pairs before wiring to real data (e.g. two known
landmarks with a known distance). Put these in `utils/geo.ts`.

**Haversine distance** (meters), `R = 6371000` (Earth's mean radius):
```
φ1, φ2 = lat1, lat2 in radians
Δφ = (lat2 - lat1) in radians
Δλ = (lon2 - lon1) in radians

a = sin²(Δφ/2) + cos(φ1) · cos(φ2) · sin²(Δλ/2)
c = 2 · atan2(√a, √(1−a))
distance = R · c
```

**Initial bearing** (degrees, 0–360, 0 = north):
```
y = sin(Δλ) · cos(φ2)
x = cos(φ1) · sin(φ2) − sin(φ1) · cos(φ2) · cos(Δλ)
θ = atan2(y, x)
bearing = (θ · 180/π + 360) mod 360
```
Recompute on every fresh coordinate pair (yours from `watchPosition`, theirs
from the `GET /locations` poll or the Realtime push) — don't cache.

## Sprite scene architecture
This is a stylized proximity indicator, not a literal to-scale map — the two
characters always render walking toward each other on a fixed-width "road,"
with the **gap between them** driven by `distance` (some reasonable mapping,
e.g. capped/log scale so 5000m and 50m aren't visually identical but also
don't force one character permanently off-screen — tune once real assets and
target distances are known) and a **directional cue** (compass arrow, or tilt/
facing of the sprite) driven by `bearing` relative to the device's own heading
if available. Suggested split:
- A `useDistanceBearing(myCoords, friendCoords)` hook wrapping the geo math above.
- Framer Motion (`animate`/`useSpring`) drives each character's horizontal
  position and any scale/opacity changes as distance updates — smooth, reacts
  to prop/state changes declaratively, no manual rAF loop needed.
- GSAP drives the walk-cycle itself: stepping through sprite sheet frames on a
  loop while a character is "moving" (distance decreasing / relative position
  changing), holding on an idle frame when stationary. This is a separate
  concern from *where* the character is — keep the two loosely coupled (e.g.
  the walk-cycle timeline just needs a boolean "is this character currently
  moving" and doesn't care why).
- Road + background are static art layered behind the two character layers —
  no physics/collision needed, this is a 2D scene, not a game engine.
Sprite sheets, background art, and character art will be supplied separately —
this doc only defines the animation *architecture*, not the specific assets.

## Suggested build order (frontend)
Build the "Find" scene's animation first, in isolation, before wiring any real
data — this mirrors the backend repo's own suggested order (`walk/CLAUDE.md`,
"Build order" step 6). Concretely:
1. Scaffold Next.js (App Router, TypeScript), install `framer-motion` and
   `gsap`. No auth, no Supabase client, no backend calls yet.
2. Build the "Find" scene as a standalone component fed by **hardcoded/mock**
   `distance`/`bearing` values (or a dev-only slider/input to fake them) —
   two placeholder sprites, road, walk-cycle, gap-closing motion. This is
   where the real animation work happens; get the feel right against fake
   numbers first.
3. Wire `utils/geo.ts` (haversine + bearing, unit-tested against known
   coordinate pairs) and feed the scene from two hardcoded lat/lng pairs
   instead of raw distance/bearing — confirms the math-to-animation pipeline
   end to end, still no network calls.
4. Only after the scene feels right: add `POST /auth/login` (or a hardcoded
   dev session token) + `watchPosition` for your own live coords, and a
   **hardcoded second user id** (skip `GET /friends` and the picker UI
   entirely for now) to pull the other side via `GET /locations?userIds=...`.
5. Friends, search, requests, invites, profile/character-picker, and the
   Realtime subscription are all later phases — not needed to see the scene
   animate with two real, moving GPS points.

## App sections (this is the whole frontend surface area)
| Section | Backend calls involved |
|---|---|
| **Login / Signup** | `POST /auth/login`, `POST /auth/signup` |
| **Find (home — the sprite scene)** | `watchPosition` (own coords) → `POST /locations` on an interval; `GET /friends` to pick who to view (max 2 at once, frontend-enforced); `GET /locations?userIds=...` + Realtime subscription for the viewed friend(s)' coords |
| **Friends** | `GET /friends` (confirmed list + unfriend action → `DELETE /friends/:friendId`), `GET /friends/requests` (incoming/sent, accept/decline), `POST /invites` (generate a shareable link) |
| **Search** (add a friend) | `GET /users/search?q=`, `POST /friends/requests` to send a request to a result |
| **Profile** | `GET /users/me` (username, character pick, created_at — email comes from the `user` object already held from login), `PATCH /users/me` to change `characterId`. Character picker UI reads from whatever character roster/assets are defined client-side and just sends the chosen id — the backend stores it opaquely, it doesn't validate against a known list yet |

## PWA / geolocation notes
- `navigator.geolocation.watchPosition` — wrap in a hook, confirm you can
  read/display your own coords before wiring anything else up.
- Add a manifest + service worker once the core scene works — installability
  is a late-stage concern, don't block early development on it.
- Test on a real phone via a deployed URL once available; `watchPosition` and
  install-to-home-screen both need a real HTTPS origin, not `localhost`, to
  fully behave like production.

## Explicit non-goals (don't build these)
- Any direct Supabase table query/write (`.from(...)` for app data) — see the
  hard rule at the top.
- A backend WebSocket/SSE gateway — Realtime already covers live push.
- Mapbox or Google Maps in any phase — card-on-file requirement, hard blocker
  for this project's "$0, no card anywhere" constraint.
- Turn-by-turn navigation, routing, or actual map tiles for the MVP sprite
  scene — that's the later Leaflet+OSM phase, separate from the core "walking
  toward each other" view.
- Validating `characterId` against a known roster server-side — the backend
  stores whatever string it's given. If/when there's a fixed character list,
  keep the validation client-side for now (or flag it as a backend follow-up
  to add a `CHECK` constraint) rather than assuming the API enforces it.