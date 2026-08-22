# Skill: Create a New npm Workspaces Monorepo

> Use this skill whenever you need to scaffold a new monorepo from scratch, following the same patterns established in the Netflix Adaptive Streaming project.

## Overview

This skill creates a **TypeScript npm workspaces monorepo** with the `apps/` + `packages/` layout pattern, Docker infrastructure, centralized env config, and Temporal workflow support.

## Step-by-Step Scaffolding

### 1. Initialize Root

```bash
mkdir <project-name> && cd <project-name>
npm init -y
```

Edit `package.json` to match this structure:

```json
{
  "name": "<project-name>",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev --workspaces --if-present",
    "build": "npm run build --workspaces --if-present",
    "docker:up": "docker compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker compose -f docker/docker-compose.yml down"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Key decisions:
- `"private": true` — monorepo root is never published
- `"workspaces"` — npm native, no Lerna/Turborepo needed
- Per-workspace dev scripts — `"dev:<app>": "npm run dev -w @<scope>/<app>"`

### 2. Create Directory Skeleton

```bash
mkdir -p apps packages docker scripts
```

### 3. Create Shared Package (`packages/shared`)

```bash
mkdir -p packages/shared/src
```

**`packages/shared/package.json`**:
```json
{
  "name": "@<scope>/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc -w"
  },
  "devDependencies": {
    "@types/node": "^22.10.3",
    "typescript": "^5.7.2"
  }
}
```

**`packages/shared/tsconfig.json`** (library pattern):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**`packages/shared/src/index.ts`**:
```typescript
export {};
```

### 4. Create Database Package (`packages/db`)

```bash
mkdir -p packages/db/src packages/db/prisma
```

**`packages/db/package.json`**:
```json
{
  "name": "@<scope>/db",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "db:generate": "dotenv -e ../../.env -- prisma generate",
    "db:migrate": "dotenv -e ../../.env -- prisma migrate dev",
    "db:push": "dotenv -e ../../.env -- prisma db push"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.0.0",
    "@prisma/client": "^7.0.0",
    "dotenv": "^16.4.7",
    "pg": "^8.13.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.3",
    "@types/pg": "^8.11.10",
    "dotenv-cli": "^8.0.0",
    "prisma": "^7.0.0",
    "typescript": "^5.7.2"
  }
}
```

**`packages/db/tsconfig.json`** (same as shared, plus exclude generated):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/generated"]
}
```

**`packages/db/prisma/schema.prisma`**:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/client"
}

datasource db {
  provider = "postgresql"
}
```

**`packages/db/prisma.config.ts`** (Prisma 7 TS config):
```typescript
import path from 'path';
import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

loadEnv({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  migrations: {
    path: path.join(__dirname, 'prisma/migrations'),
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

### 5. Create API App (`apps/api`)

```bash
mkdir -p apps/api/src/config
```

**`apps/api/package.json`**:
```json
{
  "name": "@<scope>/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "dev": "dotenv -e ../../.env -- concurrently --kill-others \"tsc -w\" \"nodemon --watch dist dist/index.js\"",
    "start": "dotenv -e ../../.env -- node dist/index.js"
  },
  "dependencies": {
    "@<scope>/db": "*",
    "@<scope>/shared": "*",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.3",
    "concurrently": "^9.1.2",
    "dotenv-cli": "^8.0.0",
    "nodemon": "^3.1.9",
    "typescript": "^5.7.2"
  }
}
```

**`apps/api/tsconfig.json`** (app pattern — no declaration):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**`apps/api/src/config/index.ts`** (config pattern):
```typescript
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/<db_name>',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  // Add more env vars as needed
};
```

**`apps/api/src/index.ts`**:
```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(config.port, () => {
  console.log(`API server running on http://localhost:${config.port}`);
});
```

### 6. Create Web App (`apps/web`)

```bash
mkdir -p apps/web/src/pages apps/web/src/api
```

**`apps/web/package.json`**:
```json
{
  "name": "@<scope>/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.1"
  },
  "devDependencies": {
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.2",
    "vite": "^6.0.6"
  }
}
```

**`apps/web/tsconfig.json`** (Vite/React pattern):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

**`apps/web/vite.config.ts`**:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
```

### 7. Create Temporal Worker App (`apps/worker`) — if needed

```bash
mkdir -p apps/worker/src/{activities,workflows,config} apps/worker/scripts
```

**Key files**:
- `apps/worker/src/worker.ts` — Creates `NativeConnection`, builds `Worker` with pre-bundled workflows
- `apps/worker/src/config/index.ts` — Same pattern as API config
- `apps/worker/src/activities/index.ts` — Barrel exports all activities
- `apps/worker/src/workflows/index.ts` — Barrel exports all workflows
- `apps/worker/scripts/build-workflow-bundle.js` — Pre-compiles workflow code

**Temporal dependencies**:
```json
{
  "@temporalio/activity": "^1.11.7",
  "@temporalio/client": "^1.11.7",
  "@temporalio/worker": "^1.11.7",
  "@temporalio/workflow": "^1.11.7"
}
```

**Workflow bundle build script** (`apps/worker/scripts/build-workflow-bundle.js`):
```javascript
const { bundleWorkflowCode } = require('@temporalio/worker');
const { writeFile } = require('fs/promises');
const path = require('path');

async function build() {
  const { code } = await bundleWorkflowCode({
    workflowsPath: path.join(__dirname, '../src/workflows'),
  });
  const codePath = path.join(__dirname, '../dist/workflow-bundle.js');
  await writeFile(codePath, code);
  console.log(`Workflow bundle written to ${codePath}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### 8. Docker Infrastructure

**`docker/docker-compose.yml`**:
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

  # Add Temporal services if using workflow orchestration
  # Add application-specific services as needed

volumes:
  postgres_data:
```

### 9. Root Files

**`.env.example`**:
```env
# API
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/<db_name>
CORS_ORIGIN=http://localhost:5173

# Web (Vite)
VITE_API_URL=http://localhost:3000
```

**`.gitignore`**:
```
node_modules/
dist/
build/
generated/
packages/db/src/generated/
.env
.env.local
*.log
.DS_Store
coverage/
```

### 10. Install & Verify

```bash
cp .env.example .env    # Edit with real values
npm install             # Installs all workspaces
npm run docker:up       # Start infrastructure
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Apply migrations
npm run dev             # Start all apps
```

## Customization Checklist

When adapting this template for a new project:

- [ ] Replace `<scope>` with your npm scope (e.g., `@myapp`)
- [ ] Replace `<project-name>` with your project name
- [ ] Replace `<db_name>` with your database name
- [ ] Add/remove apps as needed (not all projects need a worker)
- [ ] Add/remove packages as needed
- [ ] Update root `package.json` scripts for your specific apps
- [ ] Add per-app dev scripts: `"dev:<app>": "npm run dev -w @<scope>/<app>"`
- [ ] Update Docker services for your infrastructure needs
- [ ] Update `.env.example` with your project's variables
