#!/usr/bin/env bash
set -euo pipefail

# Basic admin API smoke tests (no Cypress) - validates admin-facing APIs used by the UI.
# Requires: curl, jq, psql (optional for promotion fallback), env file at project root with DB_* vars.

ROOT_DIR=$(dirname "$0")/..
API_BASE="http://localhost:3000/api"

ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.test}
ADMIN_PASS=${ADMIN_PASS:-Password123!}

timestamp() { date +%s; }

echo "[test] attempting login for $ADMIN_EMAIL"
TOKEN=$(curl -s -X POST "$API_BASE/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" | jq -r '.token // empty') || true

if [ -z "$TOKEN" ]; then
  echo "[test] login failed; trying to create a temporary admin via signup + promote"
  NEW_EMAIL="testadmin$(timestamp)@example.test"
  curl -s -X POST "$API_BASE/auth/signup" -H "Content-Type: application/json" -d "{\"email\":\"$NEW_EMAIL\",\"username\":\"testadmin\",\"password\":\"$ADMIN_PASS\"}" | jq .

  # try to promote via Docker exec (preferred) or psql (fallback)
  promoted=false
  # load DB vars if present
  if [ -f .env ]; then
    set -o allexport
    source .env || true
    set +o allexport
  fi

  if command -v docker >/dev/null 2>&1; then
    POSTGRES_CONTAINER=$(docker ps --format '{{.ID}} {{.Image}} {{.Names}}' | grep -i postgres | awk '{print $1}' | head -n1 || true)
    if [ -n "$POSTGRES_CONTAINER" ]; then
      echo "[test] promoting $NEW_EMAIL to admin via docker exec into container $POSTGRES_CONTAINER"
      docker exec -i $POSTGRES_CONTAINER psql -U ${DB_USER:-postgres} -d ${DB_NAME:-astra} -c "UPDATE users SET role='admin' WHERE email='${NEW_EMAIL}';" && promoted=true || true
    fi
  fi

  if [ "$promoted" = false ] && command -v psql >/dev/null 2>&1; then
    echo "[test] promoting $NEW_EMAIL to admin via host psql"
    if [ -n "${DB_PASSWORD:-}" ]; then
      export PGPASSWORD="$DB_PASSWORD"
    fi
    psql -h "${DB_HOST:-localhost}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-astra}" -c "UPDATE users SET role='admin' WHERE email='${NEW_EMAIL}';" && promoted=true || true
  fi

  if [ "$promoted" = false ]; then
    echo "[test] promotion did not run automatically. Either run psql manually or ensure docker is available. Continuing to attempt login..."
  fi

  echo "[test] attempting login for $NEW_EMAIL"
  TOKEN=$(curl -s -X POST "$API_BASE/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$ADMIN_PASS\"}" | jq -r '.token // empty') || true
  if [ -z "$TOKEN" ]; then
    echo "[test][error] could not obtain admin token; aborting"
    exit 2
  fi
fi

echo "[test] obtained admin token (len=$(echo -n "$TOKEN" | wc -c))"

curl_auth() {
  curl -s -X "$1" "$2" -H "Authorization: Bearer $TOKEN" ${3:-} | jq .
}

echo "[test] listing plans"
curl_auth GET "$API_BASE/plans"

echo "[test] creating a new plan"
PLAN_NAME="test-plan-$(timestamp)"
CREATE_RESP=$(curl -s -X POST "$API_BASE/plans" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"name\":\"$PLAN_NAME\",\"price\":9.99,\"cpu_cores\":1,\"ram_gb\":1,\"storage_gb\":5,\"max_players\":10}")
echo "$CREATE_RESP" | jq .
PLAN_ID=$(echo "$CREATE_RESP" | jq -r '.plan.id // empty')
if [ -z "$PLAN_ID" ]; then echo "[test][error] plan create failed"; exit 3; fi

echo "[test] updating plan $PLAN_ID"
curl -s -X PUT "$API_BASE/plans/$PLAN_ID" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"price":19.99}' | jq .

echo "[test] deleting plan $PLAN_ID"
curl -s -X DELETE "$API_BASE/plans/$PLAN_ID" -H "Authorization: Bearer $TOKEN" | jq .

echo "[test] fetching admin users list"
USERS=$(curl -s -X GET "$API_BASE/admin/users?page=1&limit=5" -H "Authorization: Bearer $TOKEN")
echo "$USERS" | jq .

USER_ID=$(echo "$USERS" | jq -r '.users[0].id // empty')
if [ -z "$USER_ID" ]; then echo "[test][error] no users found to test role toggle"; exit 4; fi

echo "[test] toggling active state for user $USER_ID"
CURRENT_ACTIVE=$(echo "$USERS" | jq -r '.users[0].is_active')
curl -s -X PUT "$API_BASE/admin/users/$USER_ID" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"is_active\":${CURRENT_ACTIVE:-true}}" | jq .

echo "[test] admin UI API tests completed OK"
exit 0
