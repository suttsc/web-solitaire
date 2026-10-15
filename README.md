# Solitaire

An offline-first Klondike PWA. Vanilla TypeScript and Tailwind CSS v4 on the front end, with a small
Hono API on Cloudflare Workers (static assets + D1). Everything ships in a single Worker deploy.

## Requirements

- Node 22+
- A Cloudflare account (only for deploys)

## Getting started

```sh
npm install
npm run dev        # Vite dev server with the Worker running in workerd
```

Open the printed URL; `GET /api/health` should return `{"status":"ok"}`.

## Scripts

| Script                 | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Dev server (app + API)                                 |
| `npm run build`        | Type-check, then build the app and Worker into `dist/` |
| `npm run preview`      | Build, then serve the production build locally         |
| `npm run deploy`       | Build and deploy to Cloudflare (`wrangler login` once) |
| `npm run lint`         | ESLint (strict, type-aware)                            |
| `npm run format`       | Prettier write                                         |
| `npm run format:check` | Prettier check                                         |
| `npm run typecheck`    | `tsc -b` across app, worker and tooling configs        |
| `npm test`             | Vitest                                                 |
| `npm run cf-typegen`   | Regenerate `worker-configuration.d.ts` from Wrangler   |

Run `npm run cf-typegen` after changing `wrangler.jsonc` (for example when the D1 binding is added).

## Layout

```
src/        Front end (browser). The game engine will live in src/engine/ and never touch the DOM.
worker/     Hono API served under /api/* by the Worker; all other paths are static assets.
```
