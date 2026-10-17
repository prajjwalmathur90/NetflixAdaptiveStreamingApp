# 🎬 Netflix-Style Adaptive Streaming Platform

> A production-grade **Full-Stack Adaptive Bitrate Streaming (ABR)** platform replicating how modern media architectures (like Netflix) transcode and deliver high-performance video. Upload raw video files, orchestrate distributed multi-bitrate HLS ladder encoding (1080p → 360p) via Temporal workers and FFmpeg, and stream bandwidth-adaptive video directly in the browser with real-time `hls.js` telemetry and custom rendition switching.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [System Design & Data Flow](#system-design--data-flow)
- [Full-Stack Features](#full-stack-features)
  - [Frontend Architecture & UI Studio (`apps/web`)](#frontend-architecture--ui-studio-appsweb)
  - [Backend REST API (`apps/api`)](#backend-rest-api-appsapi)
  - [Distributed Transcoding Worker (`apps/worker`)](#distributed-transcoding-worker-appsworker)
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
- [Frontend Pages & Routing](#frontend-pages--routing)
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

The platform is designed as an **end-to-end full-stack monorepo** with three deployable applications backed by two shared internal packages:

1. **`apps/web` (Frontend SPA)** — Production React 19 + Vite frontend engineered with a carbon/obsidian studio aesthetic, live HLS telemetry, manual/auto rendition switching, and byte-accurate upload progress.
2. **`apps/api` (REST Gateway)** — High-performance Express server handling multi-part file uploads, database queries via Prisma, static HLS segment streaming, and Temporal workflow dispatching.
3. **`apps/worker` (Processing Engine)** — Distributed Temporal worker executing concurrent FFmpeg transcoding activities into adaptive HLS variants.
4. **`packages/db` & `packages/shared`** — Unified database client (Prisma 7 + PostgreSQL) and shared type definitions/constants.

---

## System Design & Data Flow

The platform implements an asynchronous **producer → queue → consumer** pattern orchestrated by Temporal.io:

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        END-TO-END DATA FLOW                           │
  └─────────────────────────────────────────────────────────────────────────┘

  ① UPLOAD                ② TRIGGER              ③ TRANSCODE
  ─────────────────────    ─────────────────────   ─────────────────────
  User selects video  ──▶  API saves file to   ──▶ Temporal workflow
  on React frontend       MEDIA_ROOT/uploads/      picks up from queue
  with byte progress      Creates DB record         │
                          (status: "pending")        ├─▶ 1080p (4000 kbps)
                          Triggers Temporal          ├─▶  720p (2500 kbps)
                          workflow                   ├─▶  520p (1500 kbps)
                                                     └─▶  360p  (900 kbps)

  ④ MASTER PLAYLIST        ⑤ CLEANUP              ⑥ PLAYBACK
  ─────────────────────    ─────────────────────   ─────────────────────
  Worker writes            Original upload file    Frontend polls API
  master.m3u8 listing      is deleted              every 3s. On status
  all resolution                                   "completed", hls.js
  variants                 DB updated to           loads master.m3u8 and
                          "completed"              adapts quality to
                                                   network bandwidth
```

### End-to-End Walkthrough

1. **Ingest & Real-time Progress** — The user drops a video into `apps/web`. An `XMLHttpRequest` tracks byte-accurate upload progress (`0%` to `100%`) directly to `/api/v1/videos/upload`.
2. **State & Orchestration Trigger** — The API writes a PostgreSQL record (`processingStatus: "pending"`), generates a unique `videoId`, and schedules `processVideoWorkflow` on Temporal's `video-processing` task queue.
3. **Distributed Transcoding** — The Temporal worker picks up the job. FFmpeg concurrently encodes four HLS renditions (1080p, 720p, 520p, 360p) into 10-second `.ts` segments with resolution-specific playlists.
4. **Master Manifest Creation** — The worker generates a `master.m3u8` playlist linking all variant playlists and their respective bitrates.
5. **Storage Cleanup** — The original source file in `MEDIA_ROOT/uploads/` is deleted to save storage, and the DB status updates to `"completed"`.
6. **Adaptive Streaming** — The frontend automatically transitions from polling to playback. `hls.js` mounts the master manifest, streaming dynamically based on network bandwidth while providing live telemetry.

---

## Full-Stack Features

### Frontend Architecture & UI Studio (`apps/web`)

The web client is built with **React 19**, **Vite 6**, and an engineering-grade custom CSS design system:

- **Clean Architectural Aesthetics** — High-contrast obsidian/carbon palette (`#0B0C0E` base, `#141619` elevated cards, `#262930` borders), cinema red accent (`#E50914`), crisp `4px`/`6px` rectangular corners, and geometric inline SVG icons (zero emojis, zero generic pill shapes, zero purple gradients).
- **Global Header with API Heartbeat** — Persistent navigation featuring a real-time health indicator polling `GET /health` every 15 seconds to display connection status.
- **Interactive Video Catalog (`/`)**:
  - Live metric counters (**Total**, **Completed**, **Processing**, **Pending**, **Failed**) computed strictly from real database records.
  - Instant debounced search filtering by original filename or `videoId`.
  - Filter tabs with rectangular indicator bars.
  - Dual-mode toggle: High-contrast technical card grid vs. dense tabular view.
  - Live client-side `<video preload="metadata">` poster preview frames for completed videos (zero placeholder images).
  - One-click UUID copy buttons with visual feedback.
- **Upload & Transcoding Ingest Studio (`/upload`)**:
  - Drag-and-drop dropzone supporting any `video/*` format.
  - Client-side File Inspector reading exact filename, byte-calculated size (KB/MB/GB), MIME type, and last modified timestamp from the browser `File` object.
  - Target HLS Transcoding Ladder preview reflecting active `.env` bitrates.
  - Byte-accurate upload progress bar (`0%` → `100%`) powered by native XHR progress events.
  - Post-upload handoff displaying Temporal `workflowId` and `videoId` with direct links to the stream player.
- **Adaptive Stream Player & Telemetry Studio (`/stream/:videoId`)**:
  - **Status Polling State Machine** — Automatically polls video status every 3000ms while `"pending"` or `"processing"`, gracefully halting when `"completed"` or `"failed"`.
  - **Transcoding Pipeline View** — Shows an active 3-step pipeline progress card (Ingest → Parallel Encoding → Master Playlist Generation) while processing.
  - **Quality / Rendition Selector** — Allows one-click switching between **Auto (ABR)** and locked manual levels (**1080p**, **720p**, **520p**, **360p**).
  - **Live Runtime Telemetry** — Synchronized to `hls.js` and HTML5 video events:
    - Decoded Resolution (`width x height`)
    - Active Bitrate (`kbps`)
    - Forward Buffer Length (continuous seconds ahead)
    - ABR Mode (`Auto` vs `Manual Lock`)
  - Stream metadata card (Video ID, Manifest path, Renditions, Segment duration).
  - Graceful 404 Not Found card with return-to-catalog routing.
- **Legal Compliance Pages (`/privacy` & `/terms`)** — Complete, professionally drafted Privacy Policy and Terms of Service covering uploaded media storage, PostgreSQL metadata retention, Temporal workflow execution data, and FFmpeg resource policies.

### Backend REST API (`apps/api`)

- Express 4.21 server with modular controller/service/repository architecture.
- Multer disk storage staging uploads into `MEDIA_ROOT/uploads/`.
- Temporal Client integration initiating asynchronous workflows.
- Static media streaming endpoint (`/media/...`) with optimized MIME types (`application/vnd.apple.mpegurl` for `.m3u8` and `video/mp2t` for `.ts`).
- Health check endpoint (`GET /health`) reporting media root accessibility and service status.

### Distributed Transcoding Worker (`apps/worker`)

- Standalone Temporal worker powered by `@temporalio/worker` and `fluent-ffmpeg`.
- Concurrently encodes all resolution variants in parallel using `Promise.all()`.
- Dynamic bitrate parameters loaded from `.env` (`BITRATE_1080P`, `BITRATE_720P`, etc.).
- Robust activity retries with automatic failure recovery.

---

## Monorepo Structure

```
netflix-adaptive-stream/
├── package.json                  # Root — npm workspaces orchestrator
├── .env / .env.example           # Centralized environment variables
├── .gitignore
│
├── apps/                         # ── Deployable Applications ──
│   ├── api/                      # @adaptive-streaming/api (Express REST Gateway)
│   │   └── src/
│   │       ├── index.ts          #   Server bootstrap & static media serving
│   │       ├── config/           #   Environment configuration (override-enabled)
│   │       ├── controller/       #   Upload, status, and catalog route handlers
│   │       ├── service/          #   Business logic layer
│   │       ├── repository/       #   Prisma database layer
│   │       ├── route/            #   Express route definitions
│   │       ├── middlewares/      #   Multer file upload handler
│   │       └── lib/              #   Temporal client & media path utilities
│   │
│   ├── web/                      # @adaptive-streaming/web (React 19 + Vite Frontend)
│   │   ├── index.html            #   HTML shell with Inter / JetBrains Mono fonts
│   │   ├── public/
│   │   │   └── favicon.svg       #   Monochrome/red geometric SVG favicon
│   │   └── src/
│   │       ├── App.tsx           #   Route configuration with persistent Layout
│   │       ├── index.css         #   Complete carbon/obsidian design system tokens
│   │       ├── main.tsx          #   Vite entrypoint
│   │       ├── api/
│   │       │   └── client.ts     #   API client (XHR upload progress, health, status)
│   │       ├── config/
│   │       │   └── site.ts       #   Site title, custom domain, legal contact info
│   │       ├── components/
│   │       │   ├── Layout.tsx    #   Persistent header, API status pill, and footer
│   │       │   ├── Icons.tsx     #   Crisp inline SVG icons (zero emojis)
│   │       │   └── StatusBadge.tsx # 4px rectangular status badges
│   │       └── pages/
│   │           ├── HomePage.tsx  #   Catalog with stats bar, search, filter, card/table
│   │           ├── UploadPage.tsx#   Ingest studio, file inspector, byte progress bar
│   │           ├── StreamPage.tsx#   HLS player, rendition switcher, live telemetry
│   │           ├── PrivacyPage.tsx # Production Privacy Policy
│   │           └── TermsPage.tsx #   Production Terms of Service
│   │
│   └── worker/                   # @adaptive-streaming/worker (Temporal Worker)
│       ├── Dockerfile            #   Multi-stage container with FFmpeg & Node.js
│       ├── scripts/              #   Temporal workflow bundling script
│       └── src/
│           ├── worker.ts         #   Worker bootstrap & connection to Temporal
│           ├── activities/       #   ffmpeg.activities (transcode, playlist, cleanup)
│           ├── workflows/        #   processVideo.workflow (orchestration DAG)
│           ├── config/           #   Worker config & dynamic bitrate loaders
│           └── lib/              #   Prisma client & filesystem helpers
│
├── packages/                     # ── Shared Internal Libraries ──
│   ├── db/                       # @adaptive-streaming/db
│   │   ├── prisma/
│   │   │   ├── schema.prisma     #   Prisma schema (Video model)
│   │   │   └── migrations/       #   PostgreSQL migrations
│   │   └── src/                  #   Generated Prisma client exports
│   │
│   └── shared/                   # @adaptive-streaming/shared
│       └── src/                  #   Resolution profiles, ProcessVideoInput, types
│
├── docker/
│   ├── docker-compose.yml        # PostgreSQL 16, Temporal, Temporal UI, Worker
│   └── temporal/dynamicconfig/   # Temporal dynamic configuration
│
└── scripts/
    └── init-media.ps1            # Initializes MEDIA_ROOT/uploads & MEDIA_ROOT/output
```

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend Framework** | React | ^19.0 | UI components and reactive state |
| **Frontend Tooling** | Vite | ^6.0 | Fast HMR dev server & production bundling |
| **Client Routing** | React Router DOM | ^7.1 | Client-side routing with deep link support |
| **Video Playback** | hls.js | ^1.5 | MediaSource Extensions ABR player & telemetry |
| **API Framework** | Express | ^4.21 | REST API gateway & static media serving |
| **Workflow Engine** | Temporal.io | ^1.11 | Durable, fault-tolerant orchestration |
| **Transcoding Engine** | FFmpeg / ffprobe | via `fluent-ffmpeg` | Multi-bitrate HLS ladder segmentation |
| **Database ORM** | Prisma | ^7.0 | Type-safe PostgreSQL access |
| **Database** | PostgreSQL | 16 (Docker) | Relational persistence |
| **Monorepo Tooling** | npm Workspaces | Native | Clean multi-package management |
| **Languages** | TypeScript | ^5.7 | End-to-end type safety |

---

## Workspace Packages

| Package Path | npm Name | Module Format | Purpose |
|-------------|----------|---------------|---------|
| `apps/api` | `@adaptive-streaming/api` | CommonJS | Express REST gateway & file uploads |
| `apps/web` | `@adaptive-streaming/web` | ESM (Vite) | React 19 SPA frontend studio |
| `apps/worker` | `@adaptive-streaming/worker` | CommonJS | Temporal FFmpeg transcoding worker |
| `packages/db` | `@adaptive-streaming/db` | CommonJS | Prisma 7 client & migrations |
| `packages/shared` | `@adaptive-streaming/shared` | CommonJS | Shared interfaces & dynamic ladder profiles |

---

## Internal Dependency Graph

```
apps/api      ──▶  packages/db   ◀──  apps/worker
     │                                     │
     └──────▶  packages/shared  ◀──────────┘

apps/web      (Consumes API via HTTP REST & HLS streaming)
packages/db   (Standalone library)
packages/shared (Standalone library)
```

---

## Database Schema

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

**Status Lifecycle:** `pending` → `processing` → `completed` | `failed`

---

## Environment Variables

All services load configuration from a **single root `.env` file**:

| Variable | Used By | Default | Description |
|----------|---------|---------|-------------|
| `PORT` | api | `3000` | Express API port |
| `DATABASE_URL` | api, worker, db | `postgresql://postgres:postgres@localhost:5432/adaptive_streaming` | PostgreSQL connection string |
| `MEDIA_ROOT` | api, worker | Host-specific path | Directory for `uploads/` and `output/` |
| `TEMPORAL_ADDRESS` | api, worker | `localhost:7233` | Temporal gRPC endpoint |
| `TEMPORAL_TASK_QUEUE` | api, worker | `video-processing` | Task queue name |
| `CORS_ORIGIN` | api | `http://localhost:5173` | Allowed frontend origin |
| `FFMPEG_PATH` | worker | `ffmpeg` | Path to FFmpeg binary |
| `FFPROBE_PATH` | worker | `ffprobe` | Path to FFprobe binary |
| `VITE_API_URL` | web | `http://localhost:3000` | API base URL for frontend |
| `BITRATE_1080P` | api, worker | `4000` | 1080p target video bitrate (kbps) |
| `BITRATE_720P` | api, worker | `2500` | 720p target video bitrate (kbps) |
| `BITRATE_520P` | api, worker | `1500` | 520p target video bitrate (kbps) |
| `BITRATE_360P` | api, worker | `900` | 360p target video bitrate (kbps) |
| `VITE_BITRATE_1080P` | web | `4000` | Frontend ladder display for 1080p |
| `VITE_BITRATE_720P` | web | `2500` | Frontend ladder display for 720p |
| `VITE_BITRATE_520P` | web | `1500` | Frontend ladder display for 520p |
| `VITE_BITRATE_360P` | web | `900` | Frontend ladder display for 360p |

---

## Getting Started

### Prerequisites

| Requirement | Minimum Version | Note |
|-------------|----------------|------|
| **Node.js** | 20.x | LTS recommended |
| **npm** | 10.x | Workspaces support |
| **Docker & Docker Compose** | Latest | Runs PostgreSQL, Temporal, and Temporal UI |
| **FFmpeg & ffprobe** | 5.x+ | Required for local worker development |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/prajjwalmathur90/NetflixAdaptiveStreamingApp.git
cd NetflixAdaptiveStreamingApp

# 2. Configure environment file
cp .env.example .env

# 3. Install all workspace dependencies
npm install
```

### Running the Stack

```bash
# ── Step 1: Start infrastructure (PostgreSQL + Temporal + Temporal UI) ──
npm run docker:up

# ── Step 2: Initialize Database ──
npm run db:generate       # Generate Prisma client
npm run db:migrate        # Execute migrations

# ── Step 3: Run the Full-Stack Applications ──
# Option A: Start all three applications at once
npm run dev

# Option B: Run each in a separate terminal
npm run dev:api           # Express API         → http://localhost:3000
npm run dev:web           # Vite React Web SPA  → http://localhost:5173
npm run dev:worker        # Temporal Worker     → connects to :7233
```

### Service Map

| Service | Endpoint | Description |
|---------|----------|-------------|
| **Web UI** | [http://localhost:5173](http://localhost:5173) | Video Catalog, Upload Studio, Adaptive Player |
| **API Server** | [http://localhost:3000](http://localhost:3000) | REST API & HLS static media server |
| **API Health** | [http://localhost:3000/health](http://localhost:3000/health) | API health check & active media root |
| **Temporal UI** | [http://localhost:8080](http://localhost:8080) | Workflow executions dashboard & event history |
| **PostgreSQL** | `localhost:5432` | Video metadata database |

---

## HLS Transcoding Pipeline

```
$MEDIA_ROOT/output/<videoId>/
├── master.m3u8                  # Master manifest (references all variants & bitrates)
├── 1080p/
│   ├── playlist.m3u8            # Variant playlist (1920x1080 @ 4000 kbps)
│   ├── segment-00000.ts
│   └── ...
├── 720p/
│   ├── playlist.m3u8            # Variant playlist (1280x720 @ 2500 kbps)
│   └── segment-*.ts
├── 520p/
│   ├── playlist.m3u8            # Variant playlist (924x520 @ 1500 kbps)
│   └── segment-*.ts
└── 360p/
    ├── playlist.m3u8            # Variant playlist (640x360 @ 900 kbps)
    └── segment-*.ts
```

### Parameterized Transcoding Ladder

| Profile | Dimensions | Bitrate | Codec | Segment Duration | Playlist Type |
|---------|------------|---------|-------|------------------|---------------|
| **1080p** | `1920 x 1080` | 4000 kbps | H.264 (libx264) + AAC | 10s | VOD |
| **720p** | `1280 x 720` | 2500 kbps | H.264 (libx264) + AAC | 10s | VOD |
| **520p** | `924 x 520` | 1500 kbps | H.264 (libx264) + AAC | 10s | VOD |
| **360p** | `640 x 360` | 900 kbps | H.264 (libx264) + AAC | 10s | VOD |

All variants are encoded in parallel using `Promise.all()` for fast turnarounds.

---

## API Reference

### Video Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/videos/upload` | Upload source video (`multipart/form-data`, field: `"video"`) |
| `GET` | `/api/v1/videos/:videoId` | Get single video status and metadata record |
| `GET` | `/api/v1/videos` | List all videos in catalog |

### Static Media Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/media/output/<videoId>/master.m3u8` | Master adaptive HLS manifest |
| `GET` | `/media/output/<videoId>/<label>/playlist.m3u8` | Rendition variant playlist |
| `GET` | `/media/output/<videoId>/<label>/segment-*.ts` | 10-second MPEG-TS video chunks |

---

## Frontend Pages & Routing

| Route | Component | Key Features |
|-------|-----------|--------------|
| `/` | `HomePage` | Real-time stats bar, instant search, status filters, grid/table toggle, live `<video>` previews |
| `/upload` | `UploadPage` | Drag-and-drop dropzone, client-side File inspector, byte-accurate progress bar, target ladder preview |
| `/stream/:videoId` | `StreamPage` | 3s polling state machine, pipeline tracker, adaptive `hls.js` player, live telemetry, quality selector |
| `/privacy` | `PrivacyPage` | Self-hosted Privacy Policy detailing media file storage, Postgres records, and log retention |
| `/terms` | `TermsPage` | Engineering Terms and Conditions for FFmpeg compute usage and media ownership |

---

## Key Commands

```bash
# Start all workspace apps in dev mode
npm run dev

# Start specific applications
npm run dev:web           # Start frontend only
npm run dev:api           # Start API only
npm run dev:worker        # Start local worker only

# Build all packages
npm run build

# Docker infrastructure management
npm run docker:up         # Start Postgres, Temporal, Temporal UI, and Worker
npm run docker:down       # Stop all containers
npm run docker:worker     # Rebuild and run containerized worker

# Database operations
npm run db:generate       # Re-generate Prisma Client
npm run db:migrate        # Apply migrations
```

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is open-source and intended for educational, architectural, and portfolio demonstrations.
