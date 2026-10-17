# 🎬 Netflix-Style Adaptive Streaming Platform

> An end-to-end **Adaptive Bitrate Streaming (ABR)** platform that replicates how Netflix delivers video. Upload any video file, and the system automatically transcodes it into multiple resolution profiles (1080p → 360p) and serves them via **HLS (HTTP Live Streaming)** — enabling seamless, bandwidth-adaptive playback in the browser.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [System Design & Data Flow](#system-design--data-flow)
- [Monorepo Structure](#monorepo-structure)
- [Technology Stack](#technology-stack)
- [Workspace Packages](#workspace-packages)
- [Internal Dependency Graph](#internal-dependency-graph)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Stack](#running-the-stack)
- [Key Commands](#key-commands)
- [Docker Services](#docker-services)
- [HLS Transcoding Pipeline](#hls-transcoding-pipeline)
- [API Reference](#api-reference)
- [Frontend Pages](#frontend-pages)
- [Configuration Patterns](#configuration-patterns)
- [Contributing](#contributing)
- [License](#license)

---

## Architecture Overview

```
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│    apps/web      │        │    apps/api       │        │   apps/worker    │
│  (React + Vite)  │──HTTP──│  (Express REST)   │─Temporal─│  (Temporal.io)   │
│  Port: 5173      │        │  Port: 3000       │  :7233 │  FFmpeg Engine   │
└──────────────────┘        └────────┬──────────┘        └────────┬─────────┘
                                     │                            │
                            ┌────────┴────────┐         ┌────────┴─────────┐
                            │  packages/db    │         │  packages/shared │
                            │  Prisma + PG    │         │  Types & Consts  │
                            └────────┬────────┘         └──────────────────┘
                                     │
                            ┌────────┴────────┐
                            │   PostgreSQL    │
                            │   (Docker)      │
                            └─────────────────┘
```

The platform follows a **clean monorepo architecture** with three deployable applications backed by two shared internal libraries. The Express API handles uploads and serves processed media, the Temporal worker orchestrates background FFmpeg transcoding, and the React SPA provides the user interface with real-time status polling and adaptive HLS playback.

---

## System Design & Data Flow

The video lifecycle follows a **producer → queue → consumer** pattern, fully orchestrated by Temporal.io for reliability and observability:

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        END-TO-END DATA FLOW                           │
  └─────────────────────────────────────────────────────────────────────────┘

  ① UPLOAD                ② TRIGGER              ③ TRANSCODE
  ─────────────────────    ─────────────────────   ─────────────────────
  User selects video  ──▶  API saves file to   ──▶ Temporal workflow
  on React frontend       MEDIA_ROOT/uploads/      picks up from queue
                          Creates DB record         │
                          (status: "pending")        ├─▶ 1080p (2000 kbps)
                          Triggers Temporal          ├─▶  720p (1000 kbps)
                          workflow                   ├─▶  480p  (700 kbps)
                                                     └─▶  360p  (400 kbps)

  ④ MASTER PLAYLIST        ⑤ CLEANUP              ⑥ PLAYBACK
  ─────────────────────    ─────────────────────   ─────────────────────
  Worker writes            Original upload file    Frontend polls API
  master.m3u8 listing      is deleted              every 3s. On status
  all resolution                                   "completed", hls.js
  variants                 DB updated to           loads master.m3u8 and
                          "completed"              adapts quality to
                                                    network bandwidth
```

### Step-by-step Walkthrough

1. **Upload Initiation** — The user selects a video on the React frontend. The file is sent via `multipart/form-data` to `/api/v1/videos/upload`. The Express API saves the file to a shared media volume (`MEDIA_ROOT/uploads/`) using `multer`.

2. **State & Orchestration Trigger** — The API creates a PostgreSQL record with `processingStatus: "pending"` and triggers a `processVideoWorkflow` on Temporal, passing the `videoId`, `inputRelativePath`, and `outputRelativePath`.

3. **Background Transcoding** — The Temporal worker picks up the task from the `video-processing` queue. FFmpeg concurrently transcodes the video into four resolution profiles, producing `.ts` segments (10s each) and a `playlist.m3u8` per variant.

4. **Master Playlist Generation** — A `master.m3u8` is written referencing all resolution-specific playlists, enabling the player to switch quality dynamically based on available bandwidth.

5. **Cleanup** — The original upload file is deleted to reclaim disk space.

6. **Adaptive Playback** — The frontend polls `/api/v1/videos/:videoId` every 3 seconds. Once status is `completed`, `hls.js` streams the video adaptively in the browser.

---

## Monorepo Structure

```
netflix-adaptive-stream/
├── package.json                  # Root — npm workspaces orchestrator
├── .env / .env.example           # Shared environment variables (single root .env)
├── .gitignore
│
├── apps/                         # ── Deployable Applications ──
│   ├── api/                      # @adaptive-streaming/api
│   │   └── src/
│   │       ├── index.ts          #   Express server entrypoint
│   │       ├── config/           #   Environment-driven config
│   │       ├── controller/       #   Route handlers (upload, status, list)
│   │       ├── service/          #   Business logic layer
│   │       ├── repository/       #   Database access via Prisma
│   │       ├── route/            #   Express route definitions
│   │       ├── middlewares/      #   Multer upload middleware
│   │       └── lib/              #   Temporal client, media path utils
│   │
│   ├── web/                      # @adaptive-streaming/web
│   │   └── src/
│   │       ├── App.tsx           #   React Router root
│   │       ├── pages/            #   HomePage, UploadPage, StreamPage
│   │       ├── api/              #   HTTP client functions
│   │       └── index.css         #   Stylesheet
│   │
│   └── worker/                   # @adaptive-streaming/worker
│       ├── Dockerfile            #   Multi-stage Docker build (FFmpeg)
│       └── src/
│           ├── worker.ts         #   Temporal worker bootstrap
│           ├── activities/       #   ffmpeg.activities, db.activities
│           ├── workflows/        #   processVideo.workflow
│           ├── config/           #   Worker config
│           └── lib/              #   DB client, helpers
│
├── packages/                     # ── Shared Internal Libraries ──
│   ├── db/                       # @adaptive-streaming/db
│   │   ├── prisma/
│   │   │   ├── schema.prisma     #   Data model (Video)
│   │   │   └── migrations/       #   Migration history
│   │   ├── prisma.config.ts      #   Prisma 7 TS config
│   │   └── src/                  #   Generated client exports
│   │
│   └── shared/                   # @adaptive-streaming/shared
│       └── src/                  #   ProcessVideoInput, Resolution, RESOLUTIONS
│
├── docker/
│   ├── docker-compose.yml        # PostgreSQL, Temporal, Temporal UI, Worker
│   └── temporal/dynamicconfig/   # Temporal dynamic configuration
│
└── scripts/
    └── init-media.ps1            # Creates MEDIA_ROOT/uploads & MEDIA_ROOT/output
```

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | ≥ 20 | Server-side JavaScript runtime |
| **Language** | TypeScript | ^5.7 | End-to-end type safety |
| **Package Manager** | npm Workspaces | native | Monorepo dependency management |
| **API Framework** | Express | ^4.21 | REST API server |
| **Frontend** | React | ^19.0 | Component-based UI |
| **Bundler** | Vite | ^6.0 | Frontend build tooling (HMR) |
| **ORM** | Prisma | ^7.0 | Type-safe database access |
| **Database** | PostgreSQL | 16 (Docker) | Persistent storage |
| **Workflow Engine** | Temporal.io | ^1.11 | Durable workflow orchestration |
| **Video Processing** | FFmpeg | via `fluent-ffmpeg` | HLS transcoding & segmenting |
| **Video Playback** | hls.js | ^1.5 | Browser-side adaptive streaming |
| **Containerization** | Docker Compose | multi-service | Infrastructure provisioning |

---

## Workspace Packages

| Package Path | npm Name | Module Format | Key Dependencies |
|-------------|----------|---------------|-----------------|
| `apps/api` | `@adaptive-streaming/api` | CommonJS | express, cors, multer, @temporalio/client, uuid |
| `apps/web` | `@adaptive-streaming/web` | ESM (Vite) | react 19, react-router-dom 7, hls.js, vite 6 |
| `apps/worker` | `@adaptive-streaming/worker` | CommonJS | @temporalio/worker, @temporalio/workflow, fluent-ffmpeg |
| `packages/db` | `@adaptive-streaming/db` | CommonJS | @prisma/client 7, @prisma/adapter-pg, prisma 7 |
| `packages/shared` | `@adaptive-streaming/shared` | CommonJS | none (dev-only: typescript) |

---

## Internal Dependency Graph

```
apps/api      ──▶  packages/db   ◀──  apps/worker
    │                                      │
    └──────▶  packages/shared  ◀───────────┘

apps/web      (standalone — no internal workspace deps)
packages/db   (standalone)
packages/shared (standalone)
```

All internal dependencies use `"*"` version specifiers in `package.json`.

---

## Database Schema

The platform uses a single `Video` model to track the full processing lifecycle:

```prisma
model Video {
  id                String   @id @default(uuid())
  videoId           String   @unique
  originalFileName  String?
  processingStatus  String?  @default("pending")  // "pending" | "processing" | "completed" | "failed"
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([processingStatus])
  @@index([createdAt])
}
```

**Status transitions:** `pending` → `processing` → `completed` | `failed`

---

## Environment Variables

All environment variables live in a **single root `.env` file**. Copy from `.env.example` to get started:

| Variable | Used By | Default | Description |
|----------|---------|---------|-------------|
| `MEDIA_ROOT` | api, worker | `/data/adaptive-streaming-media` | Root path for uploads & processed output |
| `PORT` | api | `3000` | Express API port |
| `DATABASE_URL` | api, worker, db | `postgresql://postgres:postgres@localhost:5432/adaptive_streaming` | PostgreSQL connection string |
| `TEMPORAL_ADDRESS` | api, worker | `localhost:7233` | Temporal gRPC endpoint |
| `TEMPORAL_TASK_QUEUE` | api, worker | `video-processing` | Temporal task queue name |
| `CORS_ORIGIN` | api | `http://localhost:5173` | Allowed CORS origin |
| `FFMPEG_PATH` | worker | `ffmpeg` | Path to FFmpeg binary |
| `FFPROBE_PATH` | worker | `ffprobe` | Path to FFprobe binary |
| `VITE_API_URL` | web | `http://localhost:3000` | API base URL for frontend |

### How Env Loading Works

- **api & worker** — `dotenv-cli` in npm scripts (`dotenv -e ../../.env --`) with a fallback `dotenv.config()` in `src/config/index.ts`.
- **web** — Vite reads `VITE_`-prefixed vars automatically via `import.meta.env`. The `envDir` in `vite.config.ts` points to the monorepo root.
- **db** — `prisma.config.ts` uses `dotenv` to manually load `../../.env`.

---

## Getting Started

### Prerequisites

| Requirement | Minimum Version |
|-------------|----------------|
| **Node.js** | 20.x |
| **npm** | 10.x |
| **Docker** & **Docker Compose** | Latest stable |
| **FFmpeg** | Any recent build (for local worker) |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/netflix-adaptive-streaming.git
cd netflix-adaptive-streaming

# 2. Copy environment file and fill in values
cp .env.example .env

# 3. Install all workspace dependencies
npm install
```

### Running the Stack

```bash
# ── Step 1: Start infrastructure (PostgreSQL + Temporal + Temporal UI) ──
npm run docker:up

# ── Step 2: Initialize the database ──
npm run db:generate       # Generate Prisma client
npm run db:migrate        # Run migrations

# ── Step 3: Initialize media directories ──
npm run init:media        # Creates uploads/ and output/ under MEDIA_ROOT

# ── Step 4: Start the applications ──
npm run dev:api           # Express API        → http://localhost:3000
npm run dev:web           # Vite React frontend → http://localhost:5173
npm run dev:worker        # Temporal worker     → connects to :7233
```

> **💡 Tip:** Run all three apps at once with `npm run dev`

| Service | URL |
|---------|-----|
| **Web UI** | [http://localhost:5173](http://localhost:5173) |
| **API Server** | [http://localhost:3000](http://localhost:3000) |
| **API Health Check** | [http://localhost:3000/health](http://localhost:3000/health) |
| **Temporal UI** | [http://localhost:8080](http://localhost:8080) |

---

## Key Commands

```bash
# ── Development ──
npm run dev               # Start all apps concurrently
npm run dev:api           # Start API server only
npm run dev:web           # Start frontend only
npm run dev:worker        # Start Temporal worker only

# ── Build ──
npm run build             # Build all workspaces

# ── Database ──
npm run db:generate       # Regenerate Prisma client
npm run db:migrate        # Apply pending migrations

# ── Docker ──
npm run docker:up         # Start Postgres, Temporal, Temporal UI
npm run docker:down       # Stop all Docker services
npm run docker:worker     # Build & run worker in Docker container

# ── Media ──
npm run init:media        # Create upload/output directories
```

---

## Docker Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | `postgres:16-alpine` | `5432` | Application database |
| `temporal` | `temporalio/auto-setup:1.25.2` | `7233` | Durable workflow orchestration (shares Postgres) |
| `temporal-ui` | `temporalio/ui:2.31.2` | `8080` | Temporal Web dashboard |
| `worker` | Custom multi-stage Dockerfile | — | Containerized FFmpeg transcoding worker |

The worker Dockerfile uses a **multi-stage build** (`node:20-bookworm-slim`) with FFmpeg installed in both stages — builder for compilation, runner for production execution.

---

## HLS Transcoding Pipeline

When a video is processed, the worker creates the following output structure:

```
$MEDIA_ROOT/output/<videoId>/
├── master.m3u8                  # Master playlist (references all variants)
├── 1080p/
│   ├── playlist.m3u8            # Variant playlist (1920×1080, 2000 kbps)
│   ├── segment-00000.ts
│   ├── segment-00001.ts
│   └── ...
├── 720p/
│   ├── playlist.m3u8            # Variant playlist (1280×720, 1000 kbps)
│   └── segment-*.ts
├── 480p/
│   ├── playlist.m3u8            # Variant playlist (960×540, 700 kbps)
│   └── segment-*.ts
└── 360p/
    ├── playlist.m3u8            # Variant playlist (640×360, 400 kbps)
    └── segment-*.ts
```

### Resolution Profiles

| Label | Resolution | Video Bitrate | Codec | Segment Duration |
|-------|-----------|---------------|-------|-----------------|
| **1080p** | 1920 × 1080 | 2000 kbps | H.264 (libx264) + AAC | 10s |
| **720p** | 1280 × 720 | 1000 kbps | H.264 (libx264) + AAC | 10s |
| **480p** | 960 × 540 | 700 kbps | H.264 (libx264) + AAC | 10s |
| **360p** | 640 × 360 | 400 kbps | H.264 (libx264) + AAC | 10s |

All transcoding runs **concurrently** via `Promise.all()` inside the Temporal workflow for maximum throughput.

---

## API Reference

### Video Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/videos/upload` | Upload a video file (`multipart/form-data`) |
| `GET` | `/api/v1/videos/:videoId` | Get video status and metadata |
| `GET` | `/api/v1/videos` | List all videos |

### Media Serving

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/media/output/<videoId>/master.m3u8` | Master HLS playlist |
| `GET` | `/media/output/<videoId>/<label>/playlist.m3u8` | Variant playlist |
| `GET` | `/media/output/<videoId>/<label>/segment-*.ts` | MPEG-TS segments |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | API health status |

---

## Frontend Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `HomePage` | Lists all uploaded videos with status indicators |
| `/upload` | `UploadPage` | File picker and upload form |
| `/stream/:videoId` | `StreamPage` | Adaptive HLS player with status polling |

The frontend uses **React 19** with **React Router v7** (`BrowserRouter`). The `StreamPage` polls the API every 3 seconds until the video status is `completed` or `failed`, then initializes `hls.js` for adaptive playback.

---

## Configuration Patterns

### TypeScript — Backend (api, worker, db, shared)

- **Target:** `ES2022` — **Module:** `commonjs`
- Output: `./dist`, rootDir: `./src`, strict mode enabled
- `esModuleInterop: true`
- Library packages (`db`, `shared`) emit declarations

### TypeScript — Frontend (web)

- **Target:** `ES2022` — **Module:** `ESNext`
- `moduleResolution: "bundler"` (Vite), `jsx: "react-jsx"`, `noEmit: true`
- Extra strict: `noUnusedLocals`, `noUnusedParameters`

### Dev Script Pattern (API)

```bash
dotenv -e ../../.env -- concurrently --kill-others "tsc -w" "nodemon --watch dist dist/index.js"
```

Runs the TypeScript compiler in watch mode alongside nodemon, with `dotenv-cli` loading the root `.env` before spawning child processes.

### Temporal Workflow Pattern

```typescript
// Workflows use proxyActivities with type-only imports
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const { transcodeResolution, writeMasterPlaylist } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '1 hour',
    retry: { maximumAttempts: 3 },
  });
```

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Workspace scope | `@adaptive-streaming/` | `@adaptive-streaming/api` |
| Activities | `*.activities.ts` | `ffmpeg.activities.ts` |
| Workflows | `*.workflow.ts` | `processVideo.workflow.ts` |
| Config | `src/config/index.ts` | per-app config module |
| Pages | `src/pages/<PageName>.tsx` | `StreamPage.tsx` |
| API client | `src/api/client.ts` | frontend HTTP functions |

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is for educational and portfolio purposes.
