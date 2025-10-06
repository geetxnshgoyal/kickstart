#!/usr/bin/env bash
set -euo pipefail
BASE_URL=${BASE_URL:-http://localhost:3000}
ADMIN_KEY=${ADMIN_KEY:-12345678@}

echo "Checking health..."
curl -s "$BASE_URL/health" | jq '.'

echo "Checking status..."
curl -s "$BASE_URL/api/status" | jq '.'

echo "Listing teams (first 3)..."
curl -s -H "x-admin-key: $ADMIN_KEY" "$BASE_URL/api/admin/registrations?view=teams" | jq '.teams[0:3]'

echo "Exporting CSV (first 100 bytes)..."
curl -s -H "x-admin-key: $ADMIN_KEY" "$BASE_URL/api/admin/export?view=teams" | head -c 200

echo "Smoke test complete"
