# Skill: Prisma Database Management

> Use this skill to manage Prisma schemas, migrations, and the DB package in the monorepo.

## Package Location

```
packages/db/
├── package.json            # @<scope>/db
├── prisma.config.ts        # Prisma 7 TypeScript configuration
├── prisma/
│   ├── schema.prisma       # Schema definition
│   └── migrations/         # Migration history
├── src/
│   ├── index.ts            # Barrel export (re-exports client + types)
│   └── generated/client/   # Generated Prisma client (gitignored)
└── tsconfig.json
```

## Prisma 7 Configuration

This project uses **Prisma 7** with the TypeScript config format (`prisma.config.ts`), NOT the older `prisma.config.js` or embedded schema config.

**`packages/db/prisma.config.ts`**:
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

## Schema Conventions

**`packages/db/prisma/schema.prisma`**:
```prisma
generator client {
  provider = "prisma-client"         // Prisma 7 generator (NOT "prisma-client-js")
  output   = "../src/generated/client"
}

datasource db {
  provider = "postgresql"
  // URL comes from prisma.config.ts, NOT from schema
}

// Models go here
model Video {
  id               String   @id @default(uuid())
  originalFilename String?
  processingStatus String   @default("PENDING")
  streamUrl        String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

Key differences from Prisma < 7:
- Generator is `"prisma-client"` (not `"prisma-client-js"`)
- `datasource` does NOT include `url` — it comes from `prisma.config.ts`
- Uses `@prisma/adapter-pg` for native pg driver support

## Commands

All commands are run from the monorepo root:

```bash
# Generate the Prisma client (after schema changes)
npm run db:generate
# Equivalent to: cd packages/db && dotenv -e ../../.env -- prisma generate

# Create and apply a migration
npm run db:migrate
# Equivalent to: cd packages/db && dotenv -e ../../.env -- prisma migrate dev

# Push schema directly (skip migration file — dev only)
npm run db:push
# Equivalent to: cd packages/db && dotenv -e ../../.env -- prisma db push
```

## Adding a New Model

### 1. Edit the schema

Add your model to `packages/db/prisma/schema.prisma`:

```prisma
model NewEntity {
  id        String   @id @default(uuid())
  name      String
  status    String   @default("ACTIVE")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  parentId  String?
  parent    ParentModel? @relation(fields: [parentId], references: [id])
}
```

### 2. Generate client & create migration

```bash
npm run db:generate    # Regenerate TypeScript client
npm run db:migrate     # Create migration file and apply
```

### 3. Re-export from barrel

**`packages/db/src/index.ts`**:
```typescript
export { PrismaClient } from './generated/client';
export type { Video, NewEntity } from './generated/client';
// Or re-export everything:
// export * from './generated/client';
```

### 4. Use in consuming apps

```typescript
import { PrismaClient } from '@<scope>/db';

const prisma = new PrismaClient();
const entity = await prisma.newEntity.findFirst({ where: { id } });
```

## Common Patterns

### Singleton Prisma Client

```typescript
// packages/db/src/index.ts
import { PrismaClient } from './generated/client';

let prisma: PrismaClient;

export function getDb(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export { PrismaClient };
export type { Video } from './generated/client';
```

### Status Enum Pattern (used in this project)

Instead of Prisma enums, this project uses string fields with TypeScript union types:

```prisma
// In schema
model Video {
  processingStatus String @default("PENDING")
}
```

```typescript
// In packages/shared
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
```

### Build Order in Docker

When building the db package in Docker:
```dockerfile
RUN npm run db:generate -w @<scope>/db   # Generate client FIRST
RUN npm run build -w @<scope>/db         # Then compile TypeScript
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `prisma generate` fails with missing env | Ensure `dotenv-cli` loads `../../.env` or `prisma.config.ts` loads it |
| Import errors after schema change | Run `npm run db:generate` to regenerate client |
| Generated files showing in git | Ensure `.gitignore` has `packages/db/src/generated/` |
| Migration conflicts | Delete the conflicting migration dir and re-run `db:migrate` |
| Wrong Prisma version error | This project uses Prisma 7 — don't downgrade to Prisma 5/6 patterns |
