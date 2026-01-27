# n8n Version Manager (web)

Web UI for browsing, auditing, and restoring historical versions of n8n workflows.

## Features

- Workflows list with versions grouped by workflow
- Version details and diff views
- Restore and prune operations via API routes
- Mocked UI data for early iteration

## Tech Stack

- Next.js (App Router), React, TypeScript
- Tailwind CSS + shadcn/ui
- PostgreSQL (planned integration)
- n8n HTTP integration (webhook or REST)

## Getting Started

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Local Database (Docker)

The app uses two PostgreSQL databases:
- **App DB** (users, audit log, metadata) comes from `DATABASE_URL` in `.env.local`.
- **Versions DB** (workflow versions) is configured in the **Settings** page.

To start a typical local setup with Docker:

```bash
docker compose up -d
```

Then create `web/.env.local` from the example:

```bash
cp .env.example .env.local
```

In the UI, set the Versions DB settings to:
- Host: `localhost`
- Port: `5432`
- Database name: `versions_db`
- User: `versions_user`
- Password: `versions_pass`
- SSL mode: `disable`

## Environment Variables

Create a `.env.local` file in `web/`:

```
DATABASE_URL=postgres://user:pass@host:5432/db
N8N_BASE_URL=https://your-n8n.example.com
N8N_WEBHOOK_URL=https://your-n8n.example.com/webhook/...
N8N_API_KEY=your_api_key_optional
```

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - lint checks
