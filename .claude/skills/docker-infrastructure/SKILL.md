# Skill: Docker & Infrastructure Setup

> Use this skill to add or modify Docker Compose services and Dockerfiles in the monorepo.

## Docker Compose Location

All Docker Compose files live in `docker/docker-compose.yml` and are invoked from the monorepo root:

```bash
npm run docker:up     # docker compose -f docker/docker-compose.yml up -d
npm run docker:down   # docker compose -f docker/docker-compose.yml down
```

## Standard Service Patterns

### PostgreSQL

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: <db_name>
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:
```

### Temporal (Workflow Orchestration)

```yaml
  temporal:
    image: temporalio/auto-setup:1.25.2
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DB: postgres12
      DB_PORT: 5432
      POSTGRES_USER: postgres
      POSTGRES_PWD: postgres
      POSTGRES_SEEDS: postgres
      DYNAMIC_CONFIG_FILE_PATH: config/dynamicconfig/development-sql.yaml
    ports:
      - "7233:7233"
    volumes:
      - ./temporal/dynamicconfig:/etc/temporal/config/dynamicconfig

  temporal-ui:
    image: temporalio/ui:2.31.2
    depends_on:
      - temporal
    environment:
      TEMPORAL_ADDRESS: temporal:7233
      TEMPORAL_CORS_ORIGINS: http://localhost:5173
    ports:
      - "8080:8080"
```

Requires `docker/temporal/dynamicconfig/development-sql.yaml`:
```yaml
limit.maxIDLength:
  - value: 255
    constraints: {}
```

### Application Worker (Custom Dockerfile)

```yaml
  worker:
    build:
      context: ..          # Monorepo root (for workspace access)
      dockerfile: apps/worker/Dockerfile
    depends_on:
      - temporal
      - postgres
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/<db_name>
      TEMPORAL_ADDRESS: temporal:7233
      TEMPORAL_TASK_QUEUE: video-processing
    volumes:
      - ${MEDIA_ROOT:-./media}:/data/media
    restart: unless-stopped
```

**IMPORTANT**: The `context: ..` is critical — it goes up one level from `docker/` to the monorepo root so the Dockerfile can access all workspace packages.

## Worker Dockerfile Template

Multi-stage build pattern for a workspace app that depends on shared packages:

```dockerfile
# Stage 1: Build
FROM node:20-bookworm-slim AS builder

# Install system dependencies needed at build time
RUN apt-get update && apt-get install -y --no-install-recommends \
    <system-deps> \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests first (for Docker cache layer optimization)
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY apps/worker/package.json ./apps/worker/

# Install only the needed workspace
RUN npm install --workspace=@<scope>/worker --include-workspace-root

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/worker ./apps/worker

# Build in dependency order
RUN npm run build -w @<scope>/shared
RUN npm run db:generate -w @<scope>/db
RUN npm run build -w @<scope>/db
RUN npm run build -w @<scope>/worker

# Stage 2: Run
FROM node:20-bookworm-slim AS runner

# Install runtime system dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    <runtime-deps> \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/worker ./apps/worker
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production

WORKDIR /app/apps/worker

CMD ["node", "dist/worker.js"]
```

### Build Order Rule

When building inside Docker, respect the dependency graph:
1. `packages/shared` (no deps)
2. `packages/db` (generate client first, then build)
3. `apps/worker` (depends on shared + db)

## Adding a New Docker Service

1. Add the service to `docker/docker-compose.yml`
2. If it needs a custom Dockerfile, place it in the app directory: `apps/<name>/Dockerfile`
3. Set `context: ..` in build config to access the full monorepo
4. Add environment variables that match what the app's `config/index.ts` expects
5. Use Docker Compose service names for inter-service networking (e.g., `postgres` not `localhost`)
6. Add corresponding `npm run docker:<name>` script to root `package.json`

## Port Map

| Service | Port | Purpose |
|---------|------|---------|
| API | 3000 | REST API |
| Web | 5173 | Vite dev server |
| PostgreSQL | 5432 | Database |
| Temporal | 7233 | gRPC API |
| Temporal UI | 8080 | Web dashboard |

## Networking Notes

- Inside Docker Compose, services reach each other by **service name** (e.g., `postgres:5432`, `temporal:7233`)
- From the host machine, services are reached via `localhost:<port>`
- The `.env` defaults should use `localhost` (for local dev), while Docker Compose `environment:` should use service names
