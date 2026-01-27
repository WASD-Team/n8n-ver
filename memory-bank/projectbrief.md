# Project Brief: n8n Version Manager

## Goal
Create a web application to manage historical versions of n8n workflows stored in PostgreSQL:
- Browse versions grouped by workflow
- Restore a selected version back to n8n
- Delete old versions
- Add metadata: description, comments, tags

## Key constraints
- n8n: self-hosted Community Edition
- Version records already exist (example dump: `test_version.csv`)
- UI should be production-quality; start with “mockups in code”, then connect to DB and n8n

## Success criteria
- Operators can quickly find versions, compare, and restore safely
- Clear confirmations/audit-friendly metadata
- Reliable integration to n8n via HTTP (webhook POST or REST API depending on deployment)

