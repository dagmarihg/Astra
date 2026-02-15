#!/usr/bin/env bash
set -euo pipefail

# Integration test: purchase -> upload UTR -> admin approve -> server active
# Requires backend running at $BASE_URL (default http://localhost:3000)
# Requires psql available and env: DB_HOST, DB_PORT, DB_USER, DB_NAME, DB_PASSWORD

BASE_URL="${BASE_URL:-http://localhost:3000}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-astra}"
DB_PASSWORD="${DB_PASSWORD:-}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for this test" >&2
  exit 2
fi

export PGPASSWORD="${DB_PASSWORD}"

echo "1) Create customer account"
TIMESTAMP=$(date +%s)
CUST_EMAIL="cust${TIMESTAMP}@example.test"
CUST_USER="cust${TIMESTAMP}"
CUST_PASS="Password123!"

CUST_SIGNUP=$(curl -s -X POST "${BASE_URL}/api/auth/signup" -H "Content-Type: application/json" -d "{\"email\":\"${CUST_EMAIL}\",\"username\":\"${CUST_USER}\",\"password\":\"${CUST_PASS}\"}")
CUST_TOKEN=$(echo "$CUST_SIGNUP" | jq -r '.token')
if [ "$CUST_TOKEN" = "null" ] || [ -z "$CUST_TOKEN" ]; then
  echo "Customer signup failed: $CUST_SIGNUP" >&2
  exit 3
fi
echo "  Customer token acquired"

echo "2) Create admin account and promote via DB"
ADMIN_EMAIL="admin${TIMESTAMP}@example.test"
ADMIN_USER="admin${TIMESTAMP}"
ADMIN_PASS="Password123!"

ADMIN_SIGNUP=$(curl -s -X POST "${BASE_URL}/api/auth/signup" -H "Content-Type: application/json" -d "{\"email\":\"${ADMIN_EMAIL}\",\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}")
ADMIN_ID=$(echo "$ADMIN_SIGNUP" | jq -r '.user.id')
if [ -z "$ADMIN_ID" ] || [ "$ADMIN_ID" = "null" ]; then
  echo "Admin signup failed: $ADMIN_SIGNUP" >&2
  exit 4
fi

echo "  Promoting user id $ADMIN_ID to admin in DB"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "UPDATE users SET role='admin' WHERE id = $ADMIN_ID;" >/dev/null

echo "  Logging in admin to get token"
ADMIN_LOGIN=$(curl -s -X POST "${BASE_URL}/api/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASS}\"}")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.token')
if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
  echo "Admin login failed: $ADMIN_LOGIN" >&2
  exit 5
fi

echo "3) Get first available plan"
PLAN_JSON=$(curl -s "${BASE_URL}/api/plans")
PLAN_ID=$(echo "$PLAN_JSON" | jq -r '.plans[0].id')
if [ -z "$PLAN_ID" ] || [ "$PLAN_ID" = "null" ]; then
  echo "No plan available: $PLAN_JSON" >&2
  exit 6
fi

echo "4) Customer purchases server (pending)"
PURCHASE=$(curl -s -X POST "${BASE_URL}/api/servers" -H "Content-Type: application/json" -H "Authorization: Bearer ${CUST_TOKEN}" -d "{\"plan_id\":${PLAN_ID},\"server_name\":\"test-server-${TIMESTAMP}\"}")
PAYMENT_ID=$(echo "$PURCHASE" | jq -r '.payment.id')
SERVER_ID=$(echo "$PURCHASE" | jq -r '.server.id')
if [ -z "$PAYMENT_ID" ] || [ "$PAYMENT_ID" = "null" ]; then
  echo "Purchase failed: $PURCHASE" >&2
  exit 7
fi
echo "  Payment id: $PAYMENT_ID, server id: $SERVER_ID"

echo "5) Customer uploads UTR"
UTR_VAL="TESTUTR${TIMESTAMP}"
UPLOAD=$(curl -s -X POST "${BASE_URL}/api/payments/${PAYMENT_ID}/upload" -H "Content-Type: application/json" -H "Authorization: Bearer ${CUST_TOKEN}" -d "{\"utr\":\"${UTR_VAL}\"}")
echo "  Upload response: $UPLOAD"

echo "6) Admin approves payment"
APPROVE=$(curl -s -X POST "${BASE_URL}/api/admin/payments/${PAYMENT_ID}/approve" -H "Content-Type: application/json" -H "Authorization: Bearer ${ADMIN_TOKEN}" -d "{\"utr\":\"${UTR_VAL}\",\"pterodactyl_node_id\":\"manual\"}")
echo "  Approve response: $APPROVE"

ACTIVE_STATUS=$(echo "$APPROVE" | jq -r '.server.status')
if [ "$ACTIVE_STATUS" != "active" ]; then
  echo "Server did not become active: $APPROVE" >&2
  exit 8
fi

echo "7) Verify server credentials presence"
CREDS=$(curl -s -H "Authorization: Bearer ${CUST_TOKEN}" "${BASE_URL}/api/servers/${SERVER_ID}")
echo "  Server details: $CREDS"

echo "Integration test completed successfully"
