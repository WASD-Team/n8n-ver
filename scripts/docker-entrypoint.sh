#!/bin/sh
set -e

echo "Starting n8n-versioning..."

# Run migration if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "Running multi-tenancy migration..."
  node /app/scripts/migrate-to-multitenancy.js || {
    echo "Migration failed or already completed, continuing..."
  }
  echo "Migration check complete."
else
  echo "DATABASE_URL not set, skipping migration."
fi

# Start the application with exec to properly handle SIGTERM
echo "Starting Next.js application..."
exec node ./node_modules/.bin/next start
