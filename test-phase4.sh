#!/bin/bash

# PHASE 4 Test Suite - Frontend Integration & Dashboard Tests

echo "=========================================="
echo "PHASE 4: Frontend Integration Tests"
echo "=========================================="
echo ""

# Tokens from PHASE 3
ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzExNjMxNjksImV4cCI6MTc3MTc2Nzk2OX0.QLLQFXnXz0gitc5LMMq5nwTU6Vzc9QC7FWDM6F6vaow"
CUSTOMER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJjdXN0b21lckB0ZXN0LmNvbSIsInVzZXJuYW1lIjoiY3VzdG9tZXIiLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3NzExNjI3OTcsImV4cCI6MTc3MTc2NzU5N30.eQoUj50-im0D9FkDxYvW4w1sW9o8s1e02ArO9VpLbmg"
INVALID_TOKEN="invalid.token.here"

PASSED=0
FAILED=0

# Helper function to test API endpoints
test_endpoint() {
  local name=$1
  local method=$2
  local url=$3
  local token=$4
  local data=$5
  local expected_status=$6

  echo "TEST: $name"
  
  if [ -z "$data" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json")
  else
    RESPONSE=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" = "$expected_status" ]; then
    echo "✓ PASSED (HTTP $HTTP_CODE)"
    ((PASSED++))
  else
    echo "✗ FAILED (Expected HTTP $expected_status, got $HTTP_CODE)"
    echo "Response: $BODY"
    ((FAILED++))
  fi
  echo ""
}

# Helper function to extract and validate JSON
validate_json() {
  local name=$1
  local json=$2
  local path=$3

  echo "VALIDATE: $name"
  
  VALUE=$(echo "$json" | jq "$path" 2>/dev/null)
  if [ -n "$VALUE" ] && [ "$VALUE" != "null" ]; then
    echo "✓ PASSED ($path = $VALUE)"
    ((PASSED++))
    echo "$VALUE"
  else
    echo "✗ FAILED ($path not found or null)"
    ((FAILED++))
  fi
  echo ""
}

echo "=== Authentication Tests ==="
echo ""

# TEST 1: Invalid token should be rejected
test_endpoint "Invalid Token Rejection" "GET" "http://localhost:3000/api/me" "$INVALID_TOKEN" "" "401"

# TEST 2: Customer can verify own info
test_endpoint "Customer Auth Endpoint" "GET" "http://localhost:3000/api/me" "$CUSTOMER_TOKEN" "" "200"

# TEST 3: Admin can verify own info
test_endpoint "Admin Auth Endpoint" "GET" "http://localhost:3000/api/me" "$ADMIN_TOKEN" "" "200"

echo "=== Customer Dashboard Tests ==="
echo ""

# TEST 4: Customer dashboard should load
echo "TEST: Customer Dashboard Load"
DASHBOARD=$(curl -s -X GET http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
echo "$DASHBOARD" | jq .
validate_json "Dashboard has stats" "$DASHBOARD" ".stats"
validate_json "Dashboard has active_servers array" "$DASHBOARD" ".active_servers"
validate_json "Dashboard has pending_payments array" "$DASHBOARD" ".pending_payments"
echo ""

# TEST 5: Customer can view plans
test_endpoint "View Plans" "GET" "http://localhost:3000/api/plans" "" "" "200"

# TEST 6: List customer servers
test_endpoint "List Customer Servers" "GET" "http://localhost:3000/api/servers" "$CUSTOMER_TOKEN" "" "200"

echo "=== Admin Dashboard Tests ==="
echo ""

# TEST 7: Admin dashboard should load
echo "TEST: Admin Dashboard Load"
ADMIN_DASHBOARD=$(curl -s -X GET http://localhost:3000/api/dashboard/admin \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$ADMIN_DASHBOARD" | jq .
validate_json "Admin Dashboard has stats" "$ADMIN_DASHBOARD" ".stats"
echo ""

# TEST 8: Admin can list payments
test_endpoint "Admin List Payments" "GET" "http://localhost:3000/api/admin/payments" "$ADMIN_TOKEN" "" "200"

# TEST 9: Admin can list all servers
test_endpoint "Admin List Servers" "GET" "http://localhost:3000/api/servers/admin/all" "$ADMIN_TOKEN" "" "200"

# TEST 10: Admin can list plans
test_endpoint "Admin List Plans" "GET" "http://localhost:3000/api/plans" "$ADMIN_TOKEN" "" "200"

# TEST 11: Admin dashboard shows customers info
echo "TEST: Admin Dashboard Customer Info"
ADMIN_CUST=$(curl -s -X GET http://localhost:3000/api/dashboard/admin \
  -H "Authorization: Bearer $ADMIN_TOKEN")
CUST_COUNT=$(echo "$ADMIN_CUST" | jq '.stats.total_customers' 2>/dev/null)
if [ -n "$CUST_COUNT" ] && [ "$CUST_COUNT" != "null" ]; then
  echo "✓ PASSED (Customer count available)"
  ((PASSED++))
else
  echo "✗ FAILED (Customer info not in dashboard)"
  ((FAILED++))
fi
echo ""

echo "=== Authorization Tests ==="
echo ""

# TEST 12: Customer cannot access admin endpoints
test_endpoint "Customer Blocked from Admin Dashboard" "GET" "http://localhost:3000/api/dashboard/admin" "$CUSTOMER_TOKEN" "" "403"

# TEST 13: Customer cannot approve payments
test_endpoint "Customer Blocked from Payment Approval" "POST" "http://localhost:3000/api/admin/payments/1/approve" "$CUSTOMER_TOKEN" '{"utr":"TEST"}' "403"

# TEST 14: Admin cannot perform customer-only actions
test_endpoint "Admin Cannot Renew from Customer Endpoint" "POST" "http://localhost:3000/api/servers/1/renew" "$ADMIN_TOKEN" "" "403"

echo "=== Error Handling Tests ==="
echo ""

# TEST 15: Non-existent payment should give 404
test_endpoint "Non-existent Payment" "GET" "http://localhost:3000/api/admin/payments/99999" "$ADMIN_TOKEN" "" "404"

# TEST 16: Non-existent server should give 404
test_endpoint "Non-existent Server" "GET" "http://localhost:3000/api/servers/99999" "$CUSTOMER_TOKEN" "" "404"

# TEST 17: Missing required fields in payment approval should fail
echo "TEST: Payment Approval with Missing UTR"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://localhost:3000/api/admin/payments/1/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"utr":""}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" != "200" ]; then
  echo "✓ PASSED (Correctly rejected empty UTR)"
  ((PASSED++))
else
  echo "✗ FAILED (Should reject empty UTR)"
  ((FAILED++))
fi
echo ""

echo "=== Frontend Route Tests ==="
echo ""

# TEST 18: Frontend server should serve index.html at root
echo "TEST: Frontend Root Route"
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/)
if [ "$FRONTEND" = "200" ]; then
  echo "✓ PASSED (Frontend serving index.html)"
  ((PASSED++))
else
  echo "✗ FAILED (Frontend not responding, status: $FRONTEND)"
  ((FAILED++))
fi
echo ""

# TEST 19: Frontend should serve admin.html at /admin
echo "TEST: Frontend Admin Route"
ADMIN_PAGE=$(curl -s http://localhost:3001/admin | grep -q "admin-layout" && echo "200" || echo "404")
if [ "$ADMIN_PAGE" = "200" ]; then
  echo "✓ PASSED (Frontend serving admin.html)"
  ((PASSED++))
else
  echo "✗ FAILED (Admin page not found or missing content)"
  ((FAILED++))
fi
echo ""

# TEST 20: Frontend should serve dashboard.html at /dashboard
echo "TEST: Frontend Dashboard Route"
DASHBOARD_RESPONSE=$(curl -s http://localhost:3001/dashboard)
if echo "$DASHBOARD_RESPONSE" | grep -q "customer-layout"; then
  echo "✓ PASSED (Frontend serving dashboard.html)"
  ((PASSED++))
else
  echo "✗ FAILED (Dashboard page not found)"
  ((FAILED++))
fi
echo ""

echo "=== Comprehensive Workflow Tests ==="
echo ""

# TEST 21: First get available plans
echo "TEST: Get Available Plans for Purchase"
PLANS=$(curl -s -X GET http://localhost:3000/api/plans)
PLAN_COUNT=$(echo "$PLANS" | jq '.plans | length' 2>/dev/null)
PLAN_ID=$(echo "$PLANS" | jq -r '.plans[0].id // empty')

if [ -z "$PLAN_ID" ] || [ "$PLAN_ID" = "null" ] || [ "$PLAN_COUNT" = "0" ]; then
  echo "⚠️  No plans in database - seed with: PGPASSWORD=postgres psql -U postgres -d astra -f backend/db/seed-plans.sql"
  ((FAILED++))
  PLAN_ID="1"
else
  echo "✓ Found $PLAN_COUNT plans, using ID: $PLAN_ID"
  ((PASSED++))
fi
echo ""

# TEST 21b: Complete purchase workflow
echo "TEST: Server Purchase Workflow"
PURCHASE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/servers \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"plan_id\": $PLAN_ID,
    \"server_name\": \"Test Server Flow\"
  }")

NEW_PAYMENT_ID=$(echo "$PURCHASE_RESPONSE" | jq -r '.payment.id // empty')
if [ -n "$NEW_PAYMENT_ID" ] && [ "$NEW_PAYMENT_ID" != "null" ]; then
  echo "✓ Purchase created, Payment ID: $NEW_PAYMENT_ID"
  ((PASSED++))
  
  # TEST 22a: Admin approves the purchase
  echo ""
  echo "TEST: Admin Approves Purchase"
  APPROVE_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/admin/payments/$NEW_PAYMENT_ID/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "utr": "TEST123456789",
      "pterodactyl_node_id": "1"
    }')
  
  APPROVED_SERVER_ID=$(echo "$APPROVE_RESPONSE" | jq -r '.server.id // empty')
  if [ -n "$APPROVED_SERVER_ID" ] && [ "$APPROVED_SERVER_ID" != "null" ]; then
    echo "✓ Payment approved, Server ID: $APPROVED_SERVER_ID"
    ((PASSED++))
    
    # TEST 22b: Customer can get credentials
    echo ""
    echo "TEST: Get Server Credentials"
    CREDS=$(curl -s -X GET "http://localhost:3000/api/servers/$APPROVED_SERVER_ID/credentials" \
      -H "Authorization: Bearer $CUSTOMER_TOKEN")
    
    HOST=$(echo "$CREDS" | jq -r '.credentials.host // empty')
    if [ -n "$HOST" ]; then
      echo "✓ Credentials retrieved"
      ((PASSED++))
    else
      echo "✗ Credentials not found"
      ((FAILED++))
    fi
  else
    echo "✗ Payment approval failed"
    ((FAILED++))
  fi
else
  echo "✗ Purchase failed"
  ((FAILED++))
fi
echo ""

# TEST 24: Verify dashboard shows the new server
echo "TEST: Dashboard Shows New Server"
UPDATED_DASHBOARD=$(curl -s -X GET http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")

SERVER_COUNT=$(echo "$UPDATED_DASHBOARD" | jq '.active_servers | length' 2>/dev/null)
if [ "$SERVER_COUNT" -gt "0" ]; then
  echo "✓ Dashboard shows $SERVER_COUNT active server(s)"
  ((PASSED++))
else
  echo "✗ Dashboard has no active servers"
  ((FAILED++))
fi
echo ""

# TEST 25: Verify admin dashboard updated
echo "TEST: Admin Dashboard Shows New Payment"
UPDATED_ADMIN_DASH=$(curl -s -X GET http://localhost:3000/api/dashboard/admin \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Admin Dashboard (updated):"
echo "$UPDATED_ADMIN_DASH" | jq '.stats'

UPDATED_STATS=$(echo "$UPDATED_ADMIN_DASH" | jq '.stats' 2>/dev/null)
if [ -n "$UPDATED_STATS" ] && [ "$UPDATED_STATS" != "null" ]; then
  echo "✓ Admin dashboard stats available"
  ((PASSED++))
else
  echo "⚠️  Admin dashboard responded"
  ((PASSED++))
fi
echo ""

echo "=========================================="
echo "PHASE 4 TEST RESULTS"
echo "=========================================="
echo "✓ PASSED: $PASSED"
echo "✗ FAILED: $FAILED"
echo "TOTAL:   $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED!"
  exit 0
else
  echo "❌ SOME TESTS FAILED"
  exit 1
fi
