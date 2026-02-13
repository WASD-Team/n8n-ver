# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

Communicate with the user in **Russian**. Code and commands stay in English. Code comments should be in Russian.

## Project Overview

**n8n Version Manager** — web-app for browsing, auditing, and restoring workflow versions from n8n instances. Supports multi-tenancy (multiple n8n instances), user roles, audit logging, and version diff/restore.

## Commands

```bash
npm run dev          # Dev server at localhost:3000
npm run build        # Production build
npm run start        # Run production build
npm run lint         # ESLint (eslint without args)
```

Local PostgreSQL for development:
```bash
docker compose -f docker-compose.local.yml up -d
```

No test framework is configured — there are no tests.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind CSS 4** via `@tailwindcss/postcss`
- **PostgreSQL 16** via `pg` driver (no ORM)
- **Node.js 20** (Alpine for Docker)
- Path alias: `@/*` → `./src/*`

## Architecture

### Two Databases

1. **app_db** (connection via `DATABASE_URL` env) — users, instances, memberships, settings, audit log, version metadata. Managed by `getAppPool()` in `src/lib/db.ts`.
2. **versions_db** (connection configured per-instance in Settings UI) — raw n8n version data. Managed by `getVersionsPool(instanceId)` with LRU cache (max 10 pools).

Tables are auto-created on first access via `ensureXxxTable()` functions in each store module.

### Key Source Layout

- `src/app/` — Next.js App Router pages and API routes
- `src/app/api/` — REST API (auth, versions, workflows, users, instances, settings)
- `src/components/` — React client components (each page typically has a `*Client.tsx` component)
- `src/lib/` — Business logic and data stores (no ORM, raw SQL via `pg`)
- `src/middleware.ts` — Route protection: redirects to `/login` if no `vm_user` cookie

### Auth & Roles

- Cookie-based sessions: `vm_user` (email), `vm_instance` (selected instance ID)
- Roles: **SuperAdmin** (all instances + user mgmt), **Admin** (full access to assigned instances), **User** (read-only)
- Bootstrap: first user is auto-created as SuperAdmin when no users exist
- Auth helpers in `src/lib/auth.ts`, user store in `src/lib/usersStore.ts`

### Multi-Tenancy

- `src/lib/instancesStore.ts` manages instances and user-instance memberships
- `src/lib/settingsStore.ts` stores per-instance DB/webhook config (encrypted with AES-256-GCM)
- Instance switching via `vm_instance` cookie, passed to server components via `x-instance-id` header

### Encryption

- `src/lib/encryption.ts` — AES-256-GCM with PBKDF2 key derivation from `ENCRYPTION_KEY` env var (must be ≥32 chars)
- Used for DB passwords in settings and sensitive data

## Environment Variables

Required:
- `DATABASE_URL` — postgres connection string for app_db
- `ENCRYPTION_KEY` — ≥32 char key for AES-256-GCM encryption

Optional:
- `N8N_BASE_URL`, `N8N_WEBHOOK_URL`, `N8N_API_KEY` — n8n integration

## Docker & Deployment

- **Dockerfile**: Multi-stage build (deps → builder → runner). Entrypoint runs migration then starts Next.js.
- **docker-compose.local.yml**: Local dev PostgreSQL
- **deploy/docker-compose.yml**: Production stack (PostgreSQL + web)
- **helm/n8n-ver/**: Kubernetes Helm chart targeting `n8n-ver.infra.overgear.in`

### Post-Commit Workflow

After `git push`, Docker image is built by GitHub Actions (`.github/workflows/deploy.yml`), pushed to ECR with `{commit_sha}` and `latest` tags. Before pushing, verify that `docker-compose.yml` has the correct full SHA in the image tag (`ghcr.io/altvk88/n8n-ver-web:{FULL_SHA}`).

Check build status:
```bash
gh run list --repo altvk88/n8n-ver --branch auto-deploy --limit 1
```
