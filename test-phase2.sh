#!/bin/bash

# PHASE 2 Test Suite - Plans, Servers, Dashboard

echo "=========================================="
echo "PHASE 2: Plans, Servers & Dashboard Tests"
echo "=========================================="
echo ""

# Fixed admin token from successful login
ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzExNjMxNjksImV4cCI6MTc3MTc2Nzk2OX0.QLLQFXnXz0gitc5LMMq5nwTU6Vzc9QC7FWDM6F6vaow"
CUSTOMER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJjdXN0b21lckB0ZXN0LmNvbSIsInVzZXJuYW1lIjoiY3VzdG9tZXIiLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3NzExNjI3OTcsImV4cCI6MTc3MTc2NzU5N30.eQoUj50-im0D9FkDxYvW4w1sW9o8s1e02ArO9VpLbmg"

# TEST 1: List Plans (Public, no auth needed)
echo "TEST 1: List Plans (public)"
PLANS=$(curl -s -X GET http://localhost:3000/api/plans)
echo "$PLANS" | jq .
FIRST_PLAN_ID=$(echo "$PLANS" | jq -r '.plans[0].id // empty')
echo "First plan ID: $FIRST_PLAN_ID"
echo ""

# TEST 2: Create Plan (Admin only)
echo "TEST 2: Create Plan (admin)"
CREATE_PLAN=$(curl -s -X POST http://localhost:3000/api/plans \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Plan",
    "description": "Test plan for server",
    "price": 9.99,
    "duration_days": 30,
    "cpu_cores": 2,
    "ram_gb": 4,
    "storage_gb": 50,
    "max_players": 20
  }')
echo "$CREATE_PLAN" | jq .
CREATED_PLAN_ID=$(echo "$CREATE_PLAN" | jq -r '.plan.id // empty')
echo "Created plan ID: $CREATED_PLAN_ID"
echo ""

# TEST 3: List Plans Again (should see new plan)
echo "TEST 3: List Plans After Creation"
PLANS2=$(curl -s -X GET http://localhost:3000/api/plans)
echo "$PLANS2" | jq . | head -20
echo ""

# TEST 4: Get Plan by ID
echo "TEST 4: Get Plan Details"
if [ -n "$CREATED_PLAN_ID" ] && [ "$CREATED_PLAN_ID" != "null" ]; then
  PLAN_DETAIL=$(curl -s -X GET "http://localhost:3000/api/plans/$CREATED_PLAN_ID")
  echo "$PLAN_DETAIL" | jq .
fi
echo ""

# TEST 5: Update Plan (Admin only)
echo "TEST 5: Update Plan (admin)"
if [ -n "$CREATED_PLAN_ID" ] && [ "$CREATED_PLAN_ID" != "null" ]; then
  UPDATE_PLAN=$(curl -s -X PUT "http://localhost:3000/api/plans/$CREATED_PLAN_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "price": 12.99,
      "max_players": 25
    }')
  echo "$UPDATE_PLAN" | jq .
fi
echo ""

# TEST 6: Try to Update Plan as Customer (should fail)
echo "TEST 6: Update Plan as Customer (should fail with 403)"
if [ -n "$CREATED_PLAN_ID" ] && [ "$CREATED_PLAN_ID" != "null" ]; then
  FAIL_UPDATE=$(curl -s -X PUT "http://localhost:3000/api/plans/$CREATED_PLAN_ID" \
    -H "Authorization: Bearer $CUSTOMER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"price": 5.99}')
  echo "$FAIL_UPDATE" | jq .
fi
echo ""

# TEST 7: Purchase Server (Customer)
echo "TEST 7: Purchase Server (customer)"
if [ -n "$CREATED_PLAN_ID" ] && [ "$CREATED_PLAN_ID" != "null" ]; then
  PURCHASE=$(curl -s -X POST http://localhost:3000/api/servers \
    -H "Authorization: Bearer $CUSTOMER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"plan_id\": $CREATED_PLAN_ID,
      \"server_name\": \"Test Server 1\"
    }")
  echo "$PURCHASE" | jq .
  SERVER_ID=$(echo "$PURCHASE" | jq -r '.server.id // empty')
  echo "Server ID: $SERVER_ID"
fi
echo ""

# TEST 8: List Customer Servers
echo "TEST 8: List Customer Servers"
CUSTOMER_SERVERS=$(curl -s -X GET http://localhost:3000/api/servers \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
echo "$CUSTOMER_SERVERS" | jq .
echo ""

# TEST 9: Get Server Details
echo "TEST 9: Get Server Details"
if [ -n "$SERVER_ID" ] && [ "$SERVER_ID" != "null" ]; then
  SERVER_DETAIL=$(curl -s -X GET "http://localhost:3000/api/servers/$SERVER_ID" \
    -H "Authorization: Bearer $CUSTOMER_TOKEN")
  echo "$SERVER_DETAIL" | jq .
fi
echo ""

# TEST 10: Renew Server
echo "TEST 10: Renew Server"
if [ -n "$SERVER_ID" ] && [ "$SERVER_ID" != "null" ]; then
  RENEW=$(curl -s -X POST "http://localhost:3000/api/servers/$SERVER_ID/renew" \
    -H "Authorization: Bearer $CUSTOMER_TOKEN")
  echo "$RENEW" | jq .
fi
echo ""

# TEST 11: Customer Dashboard
echo "TEST 11: Customer Dashboard"
CUSTOMER_DASH=$(curl -s -X GET http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
echo "$CUSTOMER_DASH" | jq .
echo ""

# TEST 12: Admin Dashboard
echo "TEST 12: Admin Dashboard"
ADMIN_DASH=$(curl -s -X GET http://localhost:3000/api/dashboard/admin \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$ADMIN_DASH" | jq .
echo ""

# TEST 13: Delete Plan (Admin)
echo "TEST 13: Delete Plan (admin)"
if [ -n "$CREATED_PLAN_ID" ] && [ "$CREATED_PLAN_ID" != "null" ]; then
  DELETE_PLAN=$(curl -s -X DELETE "http://localhost:3000/api/plans/$CREATED_PLAN_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  echo "$DELETE_PLAN" | jq .
fi
echo ""

# TEST 14: Verify Plan Deleted
echo "TEST 14: Verify Plan Deleted (should return 404)"
if [ -n "$CREATED_PLAN_ID" ] && [ "$CREATED_PLAN_ID" != "null" ]; then
  VERIFY_DELETE=$(curl -s -X GET "http://localhost:3000/api/plans/$CREATED_PLAN_ID")
  echo "$VERIFY_DELETE" | jq .
fi
echo ""

# TEST 15: Try to Access Protected Route Without Auth
echo "TEST 15: Access Protected Route Without Auth (should fail)"
NO_AUTH=$(curl -s -X GET http://localhost:3000/api/servers)
echo "$NO_AUTH" | jq .
echo ""

# TEST 16: Invalid Token
echo "TEST 16: Invalid Token (should fail)"
INVALID_TOKEN=$(curl -s -X GET http://localhost:3000/api/servers \
  -H "Authorization: Bearer invalid.token.here")
echo "$INVALID_TOKEN" | jq .
echo ""

echo "=========================================="
echo "PHASE 2 Test Suite Complete"
echo "=========================================="
