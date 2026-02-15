#!/usr/bin/env bash
set -euo pipefail

# Simple smoke tests for Phase 1
# Requires backend running at $BASE_URL (default http://localhost:3000)

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "Checking health endpoint..."
curl -fsS --max-time 5 "${BASE_URL}/health" | jq . || (echo 'Health check failed' && exit 2)

echo "Checking plans listing..."
curl -fsS --max-time 5 "${BASE_URL}/api/plans" | jq . || (echo 'Plans check failed' && exit 2)

echo "Phase 1 smoke tests passed (basic checks)"
