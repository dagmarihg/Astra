#!/usr/bin/env bash
set -euo pipefail

# Insert a pending payment into the DB and approve it via the admin API.
# Requires: Docker (with Postgres), or host psql + .env, and a valid ADMIN_TOKEN env var.

if [ -z "${ADMIN_TOKEN:-}" ]; then
  echo "Please export ADMIN_TOKEN with a valid admin JWT"
  exit 2
fi

timestamp() { date +%s; }

SQL="INSERT INTO payments (user_id, server_id, plan_id, amount, status, created_at) VALUES (1, 1, 1, 9.99, 'pending', NOW()) RETURNING id;"

DB_CONTAINER=$(docker ps --format '{{.ID}} {{.Image}} {{.Names}}' | grep -i postgres | awk '{print $1}' | head -n1 || true)
if [ -n "$DB_CONTAINER" ]; then
  echo "[auto-test] Using Postgres container $DB_CONTAINER to insert payment"
  RAW_ID=$(docker exec -i "$DB_CONTAINER" psql -U "${DB_USER:-postgres}" -d "${DB_NAME:-astra}" -t -c "$SQL")
  ID=$(echo "$RAW_ID" | tr -d '[:space:]')
else
  if command -v psql >/dev/null 2>&1 && [ -f .env ]; then
    echo "[auto-test] Using host psql to insert payment (loading .env)"
    set -o allexport
    source .env || true
    set +o allexport
    if [ -n "${DB_PASSWORD:-}" ]; then
      export PGPASSWORD="$DB_PASSWORD"
    fi
    RAW_ID=$(psql -h "${DB_HOST:-localhost}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-astra}" -t -c "$SQL")
    ID=$(echo "$RAW_ID" | tr -d '[:space:]')
  else
    echo "No Postgres container found and host psql/.env not available. Cannot insert payment."
    exit 3
  fi
fi

if [ -z "$ID" ]; then
  echo "Failed to create payment (no id returned)"
  exit 4
fi

echo "[auto-test] Created payment id=$ID"

UTR="AUTO-UTR-$(timestamp)"
echo "[auto-test] Approving payment $ID with UTR $UTR"
RESPONSE=$(curl -s -X POST "http://localhost:3000/api/payments/${ID}/approve" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"utr\":\"${UTR}\",\"pterodactyl_node_id\":1}")

echo "$RESPONSE" | jq .

echo "[auto-test] Done"
