# Skill: Add a New Workspace to an Existing Monorepo

> Use this skill to add a new app or package to an existing npm workspaces monorepo that follows the `apps/` + `packages/` pattern.

## Prerequisites

- Existing monorepo with `"workspaces": ["apps/*", "packages/*"]` in root `package.json`
- Root `.env` file with shared configuration
- TypeScript configured

## Adding a New App (`apps/<name>`)

### Step 1: Decide the app type

| Type | Module System | Key Config | Example |
|------|--------------|------------|---------|
| Express API | CommonJS | `tsc` + `nodemon` | `apps/api` |
| Temporal Worker | CommonJS | `tsc` + workflow bundle | `apps/worker` |
| React SPA (Vite) | ESM | `vite` + `react` | `apps/web` |
| CLI Tool | CommonJS | `tsc` | — |

### Step 2: Scaffold the directory

```bash
mkdir -p apps/<name>/src/config
```

### Step 3: Create `package.json`

For a **backend app** (Express API, worker, CLI):
```json
{
  "name": "@<scope>/<name>",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "dev": "dotenv -e ../../.env -- concurrently --kill-others \"tsc -w\" \"nodemon --watch dist dist/index.js\"",
    "start": "dotenv -e ../../.env -- node dist/index.js"
  },
  "dependencies": {
    "@<scope>/db": "*",
    "@<scope>/shared": "*"
  },
  "devDependencies": {
    "@types/node": "^22.10.3",
    "concurrently": "^9.1.2",
    "dotenv-cli": "^8.0.0",
    "nodemon": "^3.1.9",
    "typescript": "^5.7.2"
  }
}
```

For a **frontend app** (React + Vite):
```json
{
  "name": "@<scope>/<name>",
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

### Step 4: Create `tsconfig.json`

For **backend** (CommonJS, emits to `dist/`):
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

For **frontend** (Vite/React, no emit):
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
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### Step 5: Create config module (backend apps only)

**`apps/<name>/src/config/index.ts`**:
```typescript
import dotenv from 'dotenv';
import path from 'path';

// Resolve from dist/ → ../../../../.env (root)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const config = {
  // Add your app-specific config here
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || '',
};
```

### Step 6: Create entry point

**Backend**: `apps/<name>/src/index.ts`
**Frontend**: `apps/<name>/src/main.tsx` + `apps/<name>/index.html`

### Step 7: Update root `package.json`

Add a per-workspace dev script:
```json
{
  "scripts": {
    "dev:<name>": "npm run dev -w @<scope>/<name>"
  }
}
```

### Step 8: Install dependencies

```bash
npm install
```

npm will automatically link workspace dependencies (e.g., `@<scope>/shared: "*"`).

---

## Adding a New Package (`packages/<name>`)

### Step 1: Scaffold

```bash
mkdir -p packages/<name>/src
```

### Step 2: Create `package.json`

```json
{
  "name": "@<scope>/<name>",
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

Key: Library packages MUST have:
- `"main": "./dist/index.js"` — entry point for consumers
- `"types": "./dist/index.d.ts"` — TypeScript type entry
- `"declaration": true` in tsconfig — emit `.d.ts` files

### Step 3: Create `tsconfig.json`

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

### Step 4: Create barrel export

**`packages/<name>/src/index.ts`**:
```typescript
// Export your types, constants, and utilities here
export {};
```

### Step 5: Consume in apps

Add to any app's `package.json` dependencies:
```json
{
  "dependencies": {
    "@<scope>/<name>": "*"
  }
}
```

Then import:
```typescript
import { SomeType } from '@<scope>/<name>';
```

---

## Checklist After Adding a Workspace

- [ ] `package.json` has correct `name` with `@<scope>/` prefix
- [ ] `private: true` is set
- [ ] `tsconfig.json` is configured for the correct module system
- [ ] Library packages have `main`, `types`, and `declaration: true`
- [ ] Barrel export exists in `src/index.ts`
- [ ] Root `package.json` has a `dev:<name>` script (for apps)
- [ ] `npm install` ran successfully (workspace linking)
- [ ] New env vars added to both `.env` and `.env.example`
- [ ] `.gitignore` updated if needed (e.g., generated files)

## Common Pitfalls

1. **Forgetting `"private": true`** → npm will try to publish it
2. **Missing `"main"` and `"types"` on library packages** → consumers can't import
3. **Wrong module system** → Backend uses CommonJS, frontend uses ESM
4. **Config path resolution** → `__dirname` in compiled JS is inside `dist/`, so `../../.env` from source becomes `../../../../.env` from dist
5. **Not running `npm install` after adding** → workspace symlinks won't be created
