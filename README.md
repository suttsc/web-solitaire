# Solitaire

An offline-first Klondike PWA. Vanilla TypeScript and Tailwind CSS v4 on the front end, with a small
Hono API on Cloudflare Workers backed by D1. The app and API ship as a single Worker deploy.

- Draw 3 (main) and draw 1, Windows-style standard scoring, timer from the first move that pauses
  whenever the app loses focus, move counter, unlimited undo (counts as a move, restores the score).
- No hints. Redealing mid-game warns if useful moves remain; a stuck game offers undo or a new deal.
- Games are saved locally (IndexedDB) after every move and resume after closing the app.
- Finished games sync to D1 once you add a name; stats and leaderboards work across browsers.
- Optional password protects your name; other browsers then sign in with it.
- Four card themes, swappable in Settings: Classic (the original art), Heritage, Victorian and
  Casino. Every theme uses a phone-friendly layout: big rank top left, suit top right, a large
  suit or court portrait below.
- Extras: auto-complete, sounds, replay any past deal, Vegas scoring, and "winnable deals only"
  (a solver in a Web Worker proves each deal can be won before dealing it).

## Requirements

- Node 22+
- A Cloudflare account (only for deploys)

## Getting started

```sh
npm install
npm run db:migrate:local   # create the local D1 tables
npm run dev                # Vite dev server with the Worker running in workerd
```

Add `?seed=123&draw=1` to the URL to deal a specific game.

## Deploying

```sh
npx wrangler login
npm run db:migrate:remote
npm run deploy                          # serves on <name>.<account>.workers.dev
```

## Scripts

| Script                      | What it does                                           |
| --------------------------- | ------------------------------------------------------ |
| `npm run dev`               | Dev server (app + API + local D1)                      |
| `npm run build`             | Type-check, then build the app and Worker into `dist/` |
| `npm run preview`           | Build, then serve the production build locally         |
| `npm run deploy`            | Build and deploy to Cloudflare                         |
| `npm run lint`              | ESLint (strict, type-aware)                            |
| `npm run format`            | Prettier write (`format:check` to verify)              |
| `npm run typecheck`         | `tsc -b` across app, worker, shared and tooling        |
| `npm test`                  | Vitest: engine, app, data layer and API                |
| `npm run test:coverage`     | Vitest with coverage                                   |
| `npm run test:e2e`          | Playwright against the production build                |
| `npm run db:migrate:local`  | Apply D1 migrations locally                            |
| `npm run db:migrate:remote` | Apply D1 migrations to the deployed database           |
| `npm run cf-typegen`        | Regenerate `worker-configuration.d.ts` from Wrangler   |

If Playwright can't download its browser, point it at an installed Chromium with
`PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm run test:e2e`.

## Layout

```
src/engine/   Pure game rules: deal, moves, scoring, undo, move detection, solver. No DOM, storage or network.
src/app/      Session (game + clock), tiny store and controller turning taps into moves.
src/data/     Dexie (IndexedDB) persistence, typed API client and the sync queue.
src/ui/       Layout maths, board rendering/input, dialogs and screens.
shared/       Zod schemas and stats shared by the app and the API.
worker/       Hono API under /api/* and its D1 repository; everything else is static assets.
migrations/   D1 schema.
e2e/          Playwright specs.
src/ui/cards/ Card themes: SVG renderer, suit shapes and court portraits.
public/cards/ CC0 card artwork used by the Classic theme (see its LICENSE.md).
```

## Accounts

A name on its own is unprotected: anyone who types it can link to it, which is fine while it's just
you. Setting a password in Settings protects it. After that, linking the name needs the password,
uploads need the session token, and other browsers sign in with the name and password. Passwords
are hashed with PBKDF2-SHA256 (100k iterations, per-user salt); only SHA-256 hashes of session
tokens are stored.

Not yet in place: rate limiting on `/api/auth/login` (consider a Cloudflare rate-limiting rule),
password reset (there's no email), and changing a password.
