# yaarRadar — Real-Time Location & Sprite Animation Fix Plan

## Context for the agent
This is a Next.js (App Router, TS) PWA. Framer Motion drives sprite x/y position; GSAP drives walk-cycle frame-stepping (spritesheet offset). Real GPS coordinates come from `hooks/useGeolocation.ts`, get pushed to a NestJS backend every 5s (`POST /locations`, upsert, one row per user), and friend location comes in via a direct Supabase Realtime subscription (`postgres_changes` on the `locations` table, RLS-scoped) plus an initial `GET /locations?userIds=<friend>`. `utils/geo.ts` holds haversine distance + initial bearing. A saturating curve maps real meters to fixed pixel-canvas world-space. Both sprites ease toward a shared midpoint.

Three symptoms reported:
1. Sprites visibly slide together the instant location is toggled on.
2. Distance readout is wrong/inconsistent (e.g. showing ~1000 when devices are physically close).
3. Sprite animation doesn't reflect real direction of movement (toward/away/diagonal) — currently every canned animation variant is wired up but selection isn't driven correctly by live data, causing stuck/glitchy/suddenly-separated sprites.

Root-cause hypothesis, in priority order: **(2) is likely a unit conversion bug (km vs m) and/or stale-row bug that cascades into (1) and (3).** Fix in the order below — don't reorder, later phases assume earlier ones are correct.

---

## Phase 0 — Instrumentation (do this first, before changing behavior)

- [ ] In `utils/geo.ts`, add temporary `console.debug` (or a `DEBUG_GEO` flag) logging: raw lat/lng pair in, raw haversine output, raw bearing output, on every call.
- [ ] In the location-fetch path (both the initial `GET /locations` and the Realtime `on("postgres_changes", ...)` handler), log the full row received, including `updated_at`, and the computed staleness delta (`Date.now() - new Date(updated_at).getTime()` vs `3 * PUSH_INTERVAL_MS`).
- [ ] In the animation trigger (wherever `animate()` / motion value `.set()` is called for sprite position), log: previous target, new target, whether this is the "first fix" branch or the "update" branch.
- [ ] Test with two known real-world coordinates ~50m apart (pick two map pins) fed directly into `haversineDistance()` in isolation (unit test or scratch script) — confirm output is ~50, not ~0.05 or ~50000. This single check will likely reveal the unit bug immediately.

Acceptance: you can see, per update, the raw input coords, computed distance/bearing, staleness verdict, and animation target — before touching any UI code.

---

## Phase 1 — Fix distance/bearing calculation (utils/geo.ts)

- [ ] Audit `haversineDistance()`: confirm earth radius constant `R` and what unit it's expressed in (km vs m), and confirm the function's return value's unit is documented in its name/JSDoc (e.g. `haversineDistanceMeters`).
- [ ] Search every call site of this function and every place its return value is displayed, compared to a threshold (like the "found each other" ≤2m trigger), or fed into the saturating curve. Confirm unit consistency end-to-end — a single stray `* 1000` or missing `/ 1000` anywhere in this chain is the likely bug given the "~1000" symptom.
- [ ] Fix argument order consistency — confirm every call site passes `(lat, lon)` not `(lon, lat)`, for both points.
- [ ] Add a small unit test file (e.g. `utils/geo.test.ts`) with 2-3 known coordinate pairs and known real-world distances (computed via an external tool) as regression protection.
- [ ] Confirm `initialBearing()` returns degrees 0-360 (not radians, not -180..180) and is documented as such — mismatched conventions here will silently break Phase 4's direction bucketing.

Acceptance: isolated unit tests pass with known coordinate pairs; logged distance in Phase 0 instrumentation matches real-world expectation during a manual two-device test.

---

## Phase 2 — Fix stale/default-row bugs in the fetch path

- [ ] Confirm the **initial** `GET /locations?userIds=<friend>` response is passed through the *same* staleness check (`updated_at` fresher than 3× push interval) as the Realtime stream — not just the Realtime path. If the initial fetch bypasses this check, a leftover row from a prior session (potentially with a `(0,0)` or far-away default/placeholder location) will be treated as live.
- [ ] Confirm the upsert on `POST /locations` truly has one row per user (correct conflict key, e.g. `user_id` unique constraint) — verify in Supabase that there isn't more than one row per user accumulating, which could make `GET /locations?userIds=x` return an arbitrary/wrong row if the query doesn't explicitly order by `updated_at desc limit 1`.
- [ ] Confirm the Realtime subscription filter (`user_id=eq.<friend>`) is correctly parameterized with the actual friend ID at subscribe time (not a stale closure value from a previous friend selection) — this matters if "switching who you're viewing" is supported; re-subscribing should tear down the old channel and open a new one, not layer subscriptions.
- [ ] Confirm both devices are symmetric: device A subscribes to `user_id = eq.<B>` and device B subscribes to `user_id = eq.<A>`, and both are actively pushing their own row. Log this explicitly on both devices during a two-device test to confirm both directions are live simultaneously.

Acceptance: during a live two-device test, Phase 0 logs show no stale-row false positives/negatives, and both devices receive the other's updates within one push interval.

---

## Phase 3 — Fix the "slides together on toggle-on" bug (initial snap vs animate)

- [ ] Locate wherever sprite screen position is set from `targetX/targetY` (mapped world-space coords) — likely near the Framer Motion `useMotionValue`/`animate()` calls in the Find scene or a sprite component.
- [ ] Introduce a `hasReceivedFirstFix` ref/state, scoped per session (reset when location toggle turns off, so re-enabling triggers a fresh snap, not a slide from wherever the sprite was left).
- [ ] On the first fix after enabling location (or after switching friends), call `.set()` on the motion values directly (instant, no easing) instead of `animate()`.
- [ ] On all subsequent updates, call `animate()` (or retarget an existing spring) — confirm this retargets the *existing* motion value rather than constructing a new tween from the last rendered DOM position each time (which causes overlapping/competing animations if update interval < animation duration).
- [ ] Confirm the animation isn't being restarted by a full component remount on new data (e.g. a `key` prop changing unintentionally) — remounting resets motion values to their initial/default prop value, which itself can look like a snap-then-slide.

Acceptance: manually toggling location on shows sprites appear directly at their correct mapped position with no slide; only subsequent real movement animates.

---

## Phase 4 — Direction-of-motion state machine (replace manual animation selection)

Goal: stop hand-picking which canned animation (left/right/up/down/diagonals) plays. Instead compute it live from the data every update.

- [ ] Maintain the **previous smoothed coordinate** for each tracked person (self and friend) so a heading-of-motion can be derived from consecutive fixes, not just the bearing between the two people.
- [ ] Add a movement noise gate: only recompute heading if the person moved more than `MIN_MOVEMENT_METERS` (start with ~3-5m) since the last fix — below this, treat as stationary/idle rather than flipping direction on GPS jitter.
- [ ] Implement `headingFromDelta(prev, curr)` in `utils/geo.ts`, using the now-fixed `initialBearing()`, returning `null` if movement is below the noise gate.
- [ ] Implement an 8-way bucketing function mapping 0-360° heading to one of `N, NE, E, SE, S, SW, W, NW`, matching whatever your sprite animation keys are actually named.
- [ ] Derive per-sprite animation state each update as an explicit object, e.g. `{ direction: Direction, isMoving: boolean }`, and drive the GSAP walk-cycle / Framer Motion selection purely from this object — remove any test-only manual overrides that select animations directly.
- [ ] Separately compute "closing vs opening" (compare current smoothed distance to previous smoothed distance with a threshold) if you want the HUD or a distinct visual cue (e.g. color/arrow) for approaching vs retreating, independent of the 8-way facing direction.

Acceptance: walking test (or simulated coordinate changes) shows the correct facing direction on both sprites, updates smoothly without flicker when standing still, and doesn't misfire on GPS jitter alone.

---

## Phase 5 — Smoothing layer (prevents jitter from cascading into Phases 3 & 4)

- [ ] Add an exponential moving average (EMA) on raw lat/lng, applied only to the values fed into the animation/visual layer (not the raw values pushed to the backend or used for the "found each other ≤2m" trigger, which should stay precise).
  ```ts
  smoothed.lat += ALPHA * (raw.lat - smoothed.lat);
  smoothed.lng += ALPHA * (raw.lng - smoothed.lng);
  // ALPHA ~ 0.3–0.5, tune by feel
  ```
- [ ] Apply the same smoothing to the derived distance value before it feeds the saturating curve, so small jitter near the curve's "knee" doesn't produce disproportionate pixel jumps.
- [ ] Confirm GSAP and Framer Motion are never writing to the same CSS property on the same DOM node (Framer Motion → outer wrapper `translateX/Y`; GSAP → `background-position` or a child element's frame index only). If they currently share a node/property, split it into a wrapper + child structure.

Acceptance: standing still for 30s produces no visible sprite jitter or direction flicker; walking produces smooth, continuous motion without frame skips.

---

## Phase 6 — Two-device verification pass (after all fixes)

- [ ] Test 1 — Toggle on: both devices, confirm instant correct-position snap, no slide.
- [ ] Test 2 — Stationary both: confirm distance reading stable within a few meters, no direction flicker, walk cycle goes idle.
- [ ] Test 3 — One device walks toward the other: confirm distance decreases smoothly, sprite direction updates to reflect actual heading, walk cycle plays continuously (no freeze).
- [ ] Test 4 — One device walks away: confirm distance increases smoothly, direction flips correctly, no sudden separation jump.
- [ ] Test 5 — Diagonal movement: confirm correct diagonal bucket selected, not snapping between only cardinal directions.
- [ ] Test 6 — Toggle off then back on: confirm state resets cleanly (Phase 3's `hasReceivedFirstFix` reset) — no stale slide from last session's position.
- [ ] Test 7 — Kill/restart app mid-session on one device: confirm the other device correctly shows "Waiting for [friend] to turn on location..." once the row goes stale, rather than freezing on the last known position indefinitely.

Acceptance: all 7 pass on physical two-device test, not simulator/mocked coordinates.

---

## Notes for the agent
- Do not reorder phases — Phase 4/5 fixes will be impossible to verify correctly if Phase 1/2's underlying distance data is still wrong.
- Remove all temporary `console.debug` instrumentation from Phase 0 once Phase 6 passes, or gate it behind a `DEBUG_GEO` env flag.
- Keep raw (unsmoothed) distance for the "found each other ≤2m" trigger — smoothing is for visual/animation purposes only and should not affect that gameplay-critical threshold.