#!/bin/bash
# Create/update the n8n-ver application secret in Kubernetes
# Usage: ./create-secret.sh
#
# Required: DATABASE_URL - PostgreSQL connection string
# Optional: N8N_BASE_URL, N8N_WEBHOOK_URL, N8N_API_KEY

set -euo pipefail

NAMESPACE="n8n-ver"
SECRET_NAME="n8n-ver"

: "${DATABASE_URL:?DATABASE_URL is required}"

kubectl create secret generic "${SECRET_NAME}" \
  --namespace "${NAMESPACE}" \
  --from-literal=DATABASE_URL="${DATABASE_URL}" \
  --from-literal=N8N_BASE_URL="${N8N_BASE_URL:-}" \
  --from-literal=N8N_WEBHOOK_URL="${N8N_WEBHOOK_URL:-}" \
  --from-literal=N8N_API_KEY="${N8N_API_KEY:-}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Secret ${SECRET_NAME} updated in namespace ${NAMESPACE}"
