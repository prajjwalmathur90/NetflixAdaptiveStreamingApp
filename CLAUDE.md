# CLAUDE.md — Netflix Adaptive Streaming Monorepo

> This file is the single source of truth for Claude (and any AI assistant) working in this codebase.

## Project Overview

**Netflix-style adaptive video streaming platform** built as a lesson-structured, incremental monorepo. Videos are uploaded via a REST API, processed into multi-bitrate HLS streams by Temporal workflow workers using FFmpeg, and played back in a React frontend using hls.js.

## Architecture at a Glance

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  apps/web    │──────▶│  apps/api    │──────▶│  apps/worker │
│  (React+Vite)│ HTTP  │  (Express)   │Temporal│  (Temporal)  │
│  port 5173   │       │  port 3000   │  7233 │  FFmpeg      │
└──────────────┘       └──────┬───────┘       └──────┬───────┘
                              │                      │
                     ┌────────┴────────┐    ┌────────┴────────┐
                     │  packages/db    │    │ packages/shared  │
                     │  (Prisma + pg)  │    │  (types/consts)  │
                     └────────┬────────┘    └─────────────────┘
                              │
                      ┌───────┴───────┐
                      │  PostgreSQL   │
                      │  (Docker)     │
                      └───────────────┘
```

## Monorepo Structure

```
<root>/
├── package.json              # Root — npm workspaces orchestrator
├── .env / .env.example       # Shared env vars (single .env at root)
├── .gitignore
│
├── apps/                     # Deployable applications
│   ├── api/                  # @adaptive-streaming/api    — Express REST API
│   ├── web/                  # @adaptive-streaming/web    — React + Vite frontend
│   └── worker/               # @adaptive-streaming/worker — Temporal worker (FFmpeg)
│
├── packages/                 # Shared internal libraries
│   ├── db/                   # @adaptive-streaming/db     — Prisma schema + client
│   └── shared/               # @adaptive-streaming/shared — Shared types, constants
│
├── docker/
│   ├── docker-compose.yml    # PostgreSQL, Temporal, Temporal-UI, Worker
│   └── temporal/dynamicconfig/
│
└── scripts/
    └── init-media.sh         # Creates MEDIA_ROOT/uploads & MEDIA_ROOT/output
```

## Workspace Package Details

| Package | Name | Type | Key Dependencies |
|---------|------|------|-----------------|
| `apps/api` | `@adaptive-streaming/api` | Express REST API (CommonJS) | express, cors, multer, @temporalio/client, uuid |
| `apps/web` | `@adaptive-streaming/web` | React SPA (ESM, Vite) | react 19, react-router-dom 7, hls.js, vite 6 |
| `apps/worker` | `@adaptive-streaming/worker` | Temporal Worker (CommonJS) | @temporalio/worker, @temporalio/workflow, @temporalio/activity, fluent-ffmpeg |
| `packages/db` | `@adaptive-streaming/db` | Prisma ORM wrapper (CommonJS) | @prisma/client 7, pg, prisma 7 |
| `packages/shared` | `@adaptive-streaming/shared` | Pure types/constants (CommonJS) | none (dev-only: typescript) |

## Dependency Graph (Internal)

```
apps/api     → packages/db, packages/shared
apps/worker  → packages/db, packages/shared
apps/web     → (standalone — no internal deps)
packages/db  → (standalone)
packages/shared → (standalone)
```

All internal dependencies use `"*"` version specifier in package.json.

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | ≥ 20 |
| Language | TypeScript | ^5.7 |
| Package Manager | npm | native workspaces |
| API Framework | Express | ^4.21 |
| Frontend | React | ^19.0 |
| Bundler (web) | Vite | ^6.0 |
| ORM | Prisma | ^7.0 (with `prisma-client` generator) |
| Database | PostgreSQL | 16 (via Docker) |
| Workflow Engine | Temporal | ^1.11.7 (auto-setup 1.25.2) |
| Video Processing | FFmpeg | via fluent-ffmpeg |
| Video Playback | hls.js | ^1.5 |
| Containerization | Docker Compose | multi-service |

## Environment Variables

All env vars live in a **single root `.env`** file. The `.env.example` documents every variable:

| Variable | Used By | Default |
|----------|---------|---------|
| `MEDIA_ROOT` | api, worker | `/data/adaptive-streaming-media` |
| `PORT` | api | `3000` |
| `DATABASE_URL` | api, worker, db | `postgresql://postgres:postgres@localhost:5432/adaptive_streaming` |
| `TEMPORAL_ADDRESS` | api, worker | `localhost:7233` |
| `TEMPORAL_TASK_QUEUE` | api, worker | `video-processing` |
| `CORS_ORIGIN` | api | `http://localhost:5173` |
| `FFMPEG_PATH` | worker | `ffmpeg` |
| `FFPROBE_PATH` | worker | `ffprobe` |
| `VITE_API_URL` | web | `http://localhost:3000` |

### How env loading works
- **api & worker**: Use `dotenv-cli` in npm scripts (`dotenv -e ../../.env --`) AND have a fallback `dotenv.config()` call in `src/config/index.ts` pointing to `../../../../.env` (relative from `dist/`).
- **web**: Vite reads `VITE_`-prefixed vars automatically; uses `import.meta.env.VITE_API_URL`.
- **db**: `prisma.config.ts` uses `dotenv` to manually load `../../.env`.

## Key Commands

```bash
# Install all workspaces
npm install

# Start infrastructure (Postgres, Temporal, Temporal-UI)
npm run docker:up

# Run individual apps
npm run dev:api        # Express API on :3000
npm run dev:web        # Vite React on :5173
npm run dev:worker     # Temporal worker

# Run all apps simultaneously
npm run dev

# Database
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run Prisma migrations

# Build all workspaces
npm run build

# Docker worker (builds & runs in container)
npm run docker:worker

# Initialize media directories
npm run init:media     # Creates uploads/ and output/ under MEDIA_ROOT
```

## TypeScript Configuration Patterns

### Backend packages (api, worker, db, shared)
- Target: `ES2022`, Module: `commonjs`
- Emit to `./dist`, rootDir `./src`
- Strict mode enabled
- `esModuleInterop: true`
- Library packages (db, shared) have `declaration: true`

### Frontend (web)
- Target: `ES2022`, Module: `ESNext`
- `moduleResolution: "bundler"` (Vite)
- `jsx: "react-jsx"`, `noEmit: true` (Vite handles bundling)
- Extra strict: `noUnusedLocals`, `noUnusedParameters`

## Docker Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | postgres:16-alpine | 5432 | Application database |
| `temporal` | temporalio/auto-setup:1.25.2 | 7233 | Workflow orchestration (shares Postgres) |
| `temporal-ui` | temporalio/ui:2.31.2 | 8080 | Temporal Web UI |
| `worker` | Custom Dockerfile | — | FFmpeg processing worker |

The worker Dockerfile uses a **multi-stage build** (builder → runner) on `node:20-bookworm-slim` with FFmpeg installed.

## Conventions & Patterns

### Naming
- Workspace scoped under `@adaptive-streaming/`
- Activities: `*.activity.ts` (e.g., `placeholder.activity.ts`)
- Workflows: `*.workflow.ts` (e.g., `processVideo.workflow.ts`)
- Config: `src/config/index.ts` in each app
- Pages: `src/pages/<PageName>.tsx` in web app
- API client: `src/api/client.ts` in web app

### Barrel Exports
- Every package/module uses `index.ts` barrel exports
- Activities barrel: `export * from './<name>.activity'`
- Workflows barrel: `export { workflowName } from './<name>.workflow'`
- Library packages: `export {}` placeholder until types are added

### Temporal Workflow Pattern
```typescript
// Workflow file — import types only, use proxyActivities
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const { activityName } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});
```

Workflow bundles are pre-compiled via `scripts/build-workflow-bundle.js` using `bundleWorkflowCode()`.

### Prisma Config
- Uses `prisma.config.ts` (Prisma 7 TypeScript config format)
- Schema at `packages/db/prisma/schema.prisma`
- Generated client output: `packages/db/src/generated/client/` (gitignored)
- Uses `prisma-client` generator (not the older `prisma-client-js`)
- Adapter: `@prisma/adapter-pg` (for native pg driver support)

### Frontend Patterns
- React 19 with `react-router-dom` v7 (BrowserRouter)
- Pages: HomePage, UploadPage, StreamPage
- API client functions are stub/TODO placeholders for incremental implementation
- HLS playback via `hls.js` with `Hls.isSupported()` check
- Polling pattern for video status (3s interval until COMPLETED/FAILED)
- Minimal CSS with `.container`, `.card`, `.button`, `.status-*`, `.notice` classes

### Dev Script Pattern (API)
```bash
dotenv -e ../../.env -- concurrently --kill-others "tsc -w" "nodemon --watch dist dist/index.js"
```
- Runs TypeScript watcher + nodemon in parallel
- `dotenv-cli` loads root .env before spawning processes

## Media Storage

- **External to repo** — `MEDIA_ROOT` points to a directory outside the monorepo
- Structure: `$MEDIA_ROOT/uploads/` (raw uploads), `$MEDIA_ROOT/output/` (HLS output)
- Mounted into Docker containers as `/data/media`
- API serves processed streams; workers read uploads and write output

## Lesson Structure

This codebase is structured as incremental lessons. Comments like `Lesson N — ...` and `TODO: ...` indicate placeholder/stub code meant to be implemented progressively:
- Lesson 2: DB package (Prisma schema, models)
- Lesson 4: Worker activities (FFmpeg transcoding, DB status updates)
- Lesson 6: API routes & web client wiring

When implementing features, look for these TODO markers and follow the lesson sequence.

## Common Tasks for AI Assistants

### Adding a new API route
1. Create route handler in `apps/api/src/` (or a `routes/` subdirectory)
2. Import and mount in `apps/api/src/index.ts`
3. Use `config` object for env-driven settings
4. Wire corresponding client function in `apps/web/src/api/client.ts`

### Adding a new Temporal activity
1. Create `apps/worker/src/activities/<name>.activity.ts`
2. Export from `apps/worker/src/activities/index.ts`
3. Activities have access to config, FFmpeg, and DB client

### Adding a new Temporal workflow
1. Create `apps/worker/src/workflows/<name>.workflow.ts`
2. Use `proxyActivities` with type-only import
3. Export from `apps/worker/src/workflows/index.ts`
4. Rebuild workflow bundle: `npm run build:workflows` (in worker)

### Adding a new Prisma model
1. Edit `packages/db/prisma/schema.prisma`
2. Run `npm run db:generate` then `npm run db:migrate`
3. Re-export types from `packages/db/src/index.ts`

### Adding a new shared type/constant
1. Add to `packages/shared/src/`
2. Export from `packages/shared/src/index.ts`
3. Import in consuming packages as `@adaptive-streaming/shared`

### Adding a new React page
1. Create `apps/web/src/pages/<PageName>.tsx`
2. Add route in `apps/web/src/App.tsx`
3. Use API client functions from `apps/web/src/api/client.ts`
