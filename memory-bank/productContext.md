# Product Context

## Why this exists
n8n Community Edition does not provide rich “workflow version management” out of the box for self-hosted installations. Teams that store workflow versions in a database need a dedicated UI to browse, annotate, restore, and clean up these versions.

## Primary users
- DevOps / platform engineers operating n8n
- Automation engineers maintaining workflows

## User experience goals
- Fast navigation: Workflows → Versions → Details
- Safe restore: clear diffs, confirmations, and error messages
- Cleanliness: bulk deletion/retention workflows
- Traceability: descriptions/comments/tags per version

