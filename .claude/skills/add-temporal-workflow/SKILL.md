# Skill: Add Temporal Workflows & Activities

> Use this skill to add new Temporal workflows and activities to a monorepo worker app that follows the `apps/worker` pattern.

## Architecture

```
apps/worker/
├── src/
│   ├── worker.ts                         # Worker entry — connects to Temporal, loads bundles
│   ├── config/index.ts                   # Env config (Temporal address, task queue, etc.)
│   ├── activities/
│   │   ├── index.ts                      # Barrel — re-exports all activities
│   │   ├── <name>.activity.ts            # One file per logical activity group
│   │   └── ...
│   └── workflows/
│       ├── index.ts                      # Barrel — re-exports all workflows
│       ├── <name>.workflow.ts            # One file per workflow
│       └── ...
├── scripts/
│   └── build-workflow-bundle.js          # Pre-compiles workflows for V8 isolate
├── Dockerfile                            # Multi-stage build with FFmpeg
├── package.json
└── tsconfig.json
```

## Creating a New Activity

### 1. Create the activity file

**`apps/worker/src/activities/<name>.activity.ts`**:
```typescript
import { config } from '../config';
// Import DB client, external services, etc.

/**
 * <Description of what this activity does>
 */
export async function myActivity(input: {
  // Define your input shape
  id: string;
}): Promise<{
  // Define your output shape
  result: string;
}> {
  // Activities CAN use:
  // - I/O (network, filesystem, database)
  // - Non-deterministic operations
  // - External service calls
  // - Long-running computations
  
  return { result: 'done' };
}
```

### 2. Export from barrel

**`apps/worker/src/activities/index.ts`**:
```typescript
export * from './existing.activity';
export * from './<name>.activity';   // Add this line
```

### 3. The activity is automatically registered

The worker loads all activities via:
```typescript
import * as activities from './activities';
// ...
const worker = await Worker.create({
  activities,
  // ...
});
```

## Creating a New Workflow

### 1. Create the workflow file

**`apps/worker/src/workflows/<name>.workflow.ts`**:
```typescript
import { proxyActivities } from '@temporalio/workflow';
// IMPORTANT: Type-only import! Workflows run in a V8 isolate.
import type * as activities from '../activities';

// Create activity proxies with timeout config
const { myActivity, anotherActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',     // Max time for a single attempt
  // Optional:
  // scheduleToCloseTimeout: '30 minutes', // Max total time including retries
  // retry: { maximumAttempts: 3 },
});

/**
 * <Description of what this workflow orchestrates>
 */
export async function myWorkflow(input: {
  id: string;
}): Promise<void> {
  // Step 1: Do something
  const result = await myActivity({ id: input.id });

  // Step 2: Run activities in parallel
  await Promise.all([
    anotherActivity({ /* ... */ }),
    anotherActivity({ /* ... */ }),
  ]);

  // Workflows CANNOT use:
  // - Direct I/O or network calls
  // - Math.random(), Date.now() (non-deterministic)
  // - External libraries with side effects
  // All external work must go through activities
}
```

### 2. Export from barrel

**`apps/worker/src/workflows/index.ts`**:
```typescript
export { existingWorkflow } from './existing.workflow';
export { myWorkflow } from './<name>.workflow';   // Add this line
```

### 3. Rebuild the workflow bundle

```bash
cd apps/worker
npm run build:workflows
# Or from root:
npm run build -w @adaptive-streaming/worker
```

## Starting a Workflow from the API

In `apps/api`:

```typescript
import { Connection, Client } from '@temporalio/client';
import { config } from './config';

// Create Temporal client (typically once at app startup)
const connection = await Connection.connect({
  address: config.temporalAddress,
});
const client = new Client({ connection });

// Start a workflow
const handle = await client.workflow.start('myWorkflow', {
  taskQueue: config.temporalTaskQueue,
  workflowId: `my-workflow-${uniqueId}`,
  args: [{ id: uniqueId }],
});
```

## Key Rules

### Workflow Determinism
Workflows MUST be deterministic. They run in a sandboxed V8 isolate and replay on failure.

**DO**:
- Use `proxyActivities` for all side effects
- Use `import type` for activity imports
- Use Temporal's `sleep()` for delays
- Use Temporal's signals/queries for external input

**DON'T**:
- Call `Date.now()`, `Math.random()` directly
- Make network/filesystem calls
- Import non-workflow-safe libraries
- Use `setTimeout`/`setInterval`

### Activity Design
- Activities should be **idempotent** when possible
- Keep activities focused on a single side effect
- Configure appropriate timeouts for each activity type
- Use retry policies for transient failures

### Naming Conventions
- Activity files: `<domain>.activity.ts` (e.g., `ffmpeg.activity.ts`, `db.activity.ts`)
- Workflow files: `<action><Entity>.workflow.ts` (e.g., `processVideo.workflow.ts`)
- Activity functions: `verbNoun` (e.g., `transcodeVideo`, `updateStatus`)
- Workflow functions: `verbNounWorkflow` (e.g., `processVideoWorkflow`)

## Dockerfile Pattern

The worker Dockerfile uses multi-stage build:

```dockerfile
FROM node:20-bookworm-slim AS builder
# Install system deps (e.g., ffmpeg)
WORKDIR /app
# Copy package files for install caching
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/
RUN npm install --workspace=@<scope>/worker --include-workspace-root
# Copy source and build
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker
RUN npm run build -w @<scope>/shared
RUN npm run build -w @<scope>/worker

FROM node:20-bookworm-slim AS runner
# Install runtime system deps
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/worker ./apps/worker
COPY --from=builder /app/package.json ./package.json
ENV NODE_ENV=production
WORKDIR /app/apps/worker
CMD ["node", "dist/worker.js"]
```
