# System Patterns

## High-level pattern
- **Next.js full-stack**: UI + API routes in one repo.
- **Read versions** from PostgreSQL (versions table owned by existing system).
- **Write metadata** to a separate table in the same PostgreSQL DB (non-invasive to existing table).
- **Restore** via HTTP call to n8n (webhook POST or REST API, configurable).

## UI patterns
- Table-heavy views with:
  - search/filter/sort
  - bulk selection actions bar
  - confirmation dialogs for destructive actions

