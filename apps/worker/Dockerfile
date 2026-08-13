FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

RUN npm install --workspace=@adaptive-streaming/worker --include-workspace-root

COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

RUN npm run build -w @adaptive-streaming/shared
RUN npm run build -w @adaptive-streaming/worker

# After Lesson 2 (db package), uncomment these lines:
# COPY packages/db/package.json ./packages/db/
# COPY packages/db ./packages/db
# RUN npm run db:generate -w @adaptive-streaming/db
# RUN npm run build -w @adaptive-streaming/db

FROM node:20-bookworm-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/worker ./apps/worker
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production
ENV MEDIA_ROOT=/data/media
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

WORKDIR /app/apps/worker

CMD ["node", "dist/worker.js"]
