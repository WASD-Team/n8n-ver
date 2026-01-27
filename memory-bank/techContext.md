# Tech Context

## Stack
- Next.js (App Router) + React + TypeScript
- Tailwind CSS + shadcn/ui (UI primitives)
- PostgreSQL
- HTTP integration to n8n (webhook POST and/or REST API; chosen per deployment)

## Local development
- `web/` contains the Next.js app (created by create-next-app)
- Environment variables:
  - `DATABASE_URL`
  - `N8N_BASE_URL` / `N8N_WEBHOOK_URL`
  - `N8N_API_KEY` (optional, if using REST API)

