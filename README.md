# walk — frontend

A "Find My Friends" style app: two people see their straight-line distance
and compass bearing to each other in real time, shown as two characters
walking toward each other, closing the gap as they get closer.

This is the **frontend only** (Next.js). It talks to a separate NestJS
backend over REST, plus one direct Supabase Realtime subscription for live
location push — see [`CLAUDE.md`](./CLAUDE.md) for the full contract between
the two repos (routes, auth flow, DB schema, non-goals, etc.) before changing
anything that touches auth, friends, locations, or coordinates.

## Current status

The "Find" home screen's **animation** is built and working against mocked
coordinates — no auth, no real GPS, no backend calls yet. That's deliberate:
get the distance/bearing → position pipeline and the walk animation feeling
right in isolation first, then wire in real data. See the "Suggested build
order" section in `CLAUDE.md` for what comes after this.

What's here right now:
- Real haversine distance + compass bearing math (`utils/geo.ts`), unit-tested.
- A log-scale distance→screen-position mapping and a bearing→sway mapping
  (`utils/distanceToPosition.ts`, `utils/bearingToSway.ts`), also unit-tested.
- A "Find" scene where both people walk toward a shared center point from
  mocked coordinates, either via preset distance buttons or a "Start
  walking" simulation, spring-animated with Framer Motion.
- Placeholder dots stand in for the eventual sprite characters
  (`gsap`-driven walk-cycle sprites are the next phase, not built yet).

## Requirements

- Node.js 20+ and npm

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the
Find scene. Click "Start walking" to run the mock simulation, or use the
preset buttons to jump to a specific distance.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the unit tests (Vitest) |

## Project structure

```
app/                    Next.js App Router pages
components/scene/       The Find scene: dots, connecting line, composition
hooks/                  useFindDemo (mock walk simulation), useDistanceBearing,
                         useScreenPosition (spring-driven screen placement)
utils/                  Pure, unit-tested math: geo.ts (haversine/bearing),
                         distanceToPosition.ts, bearingToSway.ts, angle.ts
public/yaarRadar-assets/  Reference art for the eventual sprite/road assets
```

## Environment variables

Not needed yet — the app currently runs entirely on mock data. Once real
auth/location wiring starts, this repo will need a `.env.local` with:

```
NEXT_PUBLIC_API_BASE_URL=      # the NestJS backend
NEXT_PUBLIC_SUPABASE_URL=      # same Supabase project as the backend
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

See `CLAUDE.md` for what each is used for and the full auth flow.
