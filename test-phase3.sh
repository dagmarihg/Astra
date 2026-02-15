#!/bin/bash

# PHASE 3 Test Suite - Payment Approval & Server Deployment

echo "=========================================="
echo "PHASE 3: Payment Approval & Expiration Tests"
echo "=========================================="
echo ""

# Tokens from PHASE 2
ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzExNjMxNjksImV4cCI6MTc3MTc2Nzk2OX0.QLLQFXnXz0gitc5LMMq5nwTU6Vzc9QC7FWDM6F6vaow"
CUSTOMER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJjdXN0b21lckB0ZXN0LmNvbSIsInVzZXJuYW1lIjoiY3VzdG9tZXIiLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3NzExNjI3OTcsImV4cCI6MTc3MTc2NzU5N30.eQoUj50-im0D9FkDxYvW4w1sW9o8s1e02ArO9VpLbmg"

# TEST 1: List pending payments (Admin)
echo "TEST 1: List Pending Payments (admin)"
PAYMENTS=$(curl -s -X GET http://localhost:3000/api/admin/payments \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$PAYMENTS" | jq .
PAYMENT_ID=$(echo "$PAYMENTS" | jq -r '.payments[0].id // empty')
echo "First pending payment ID: $PAYMENT_ID"
echo ""

# TEST 2: Get payment details
echo "TEST 2: Get Payment Details"
if [ -n "$PAYMENT_ID" ] && [ "$PAYMENT_ID" != "null" ]; then
  PAYMENT_DETAIL=$(curl -s -X GET "http://localhost:3000/api/admin/payments/$PAYMENT_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  echo "$PAYMENT_DETAIL" | jq .
fi
echo ""

# TEST 3: Approve payment
echo "TEST 3: Approve Payment (admin)"
if [ -n "$PAYMENT_ID" ] && [ "$PAYMENT_ID" != "null" ]; then
  APPROVE=$(curl -s -X POST "http://localhost:3000/api/admin/payments/$PAYMENT_ID/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "utr": "SBIN123456789",
      "pterodactyl_node_id": "1"
    }')
  echo "$APPROVE" | jq .
  SERVER_ID=$(echo "$APPROVE" | jq -r '.server.id // empty')
  echo "Server ID: $SERVER_ID"
fi
echo ""

# TEST 4: Get server credentials (Customer)
echo "TEST 4: Get Server Credentials (customer)"
if [ -n "$SERVER_ID" ] && [ "$SERVER_ID" != "null" ]; then
  CREDS=$(curl -s -X GET "http://localhost:3000/api/servers/$SERVER_ID/credentials" \
    -H "Authorization: Bearer $CUSTOMER_TOKEN")
  echo "$CREDS" | jq .
fi
echo ""

# TEST 5: Try to get credentials for inactive server (should fail)
echo "TEST 5: Get Credentials for Inactive Server (should fail)"
INACTIVE=$(curl -s -X GET "http://localhost:3000/api/servers/999/credentials" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
echo "$INACTIVE" | jq .
echo ""

# TEST 6: List servers (should show active server)
echo "TEST 6: List Servers After Approval"
SERVERS=$(curl -s -X GET http://localhost:3000/api/servers \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
echo "$SERVERS" | jq '.servers[] | {id, server_name, status, subscription_status}' | head -20
echo ""

# TEST 7: Admin rejects another payment (if available)
echo "TEST 7: Reject Payment (admin)"
# Get second payment if available
SECOND_PAYMENT=$(curl -s -X GET http://localhost:3000/api/admin/payments \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.payments[0].id // empty')

if [ -n "$SECOND_PAYMENT" ] && [ "$SECOND_PAYMENT" != "null" ]; then
  REJECT=$(curl -s -X POST "http://localhost:3000/api/admin/payments/$SECOND_PAYMENT/reject" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"reason": "Invalid UTR"}')
  echo "$REJECT" | jq .
else
  echo "No pending payments available to reject"
fi
echo ""

# TEST 8: Customer dashboard should show active server
echo "TEST 8: Customer Dashboard After Approval"
DASHBOARD=$(curl -s -X GET http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
echo "$DASHBOARD" | jq .
echo ""

# TEST 9: Admin dashboard should show no pending payments
echo "TEST 9: Admin Dashboard"
ADMIN_DASH=$(curl -s -X GET http://localhost:3000/api/dashboard/admin \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$ADMIN_DASH" | jq .
echo ""

# TEST 10: Try to approve payment without UTR (should fail)
echo "TEST 10: Approve Payment Without UTR (should fail)"
NEW_PAYMENT=$(curl -s -X GET http://localhost:3000/api/admin/payments \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.payments[0].id // empty')

if [ -n "$NEW_PAYMENT" ] && [ "$NEW_PAYMENT" != "null" ]; then
  FAIL=$(curl -s -X POST "http://localhost:3000/api/admin/payments/$NEW_PAYMENT/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}')
  echo "$FAIL" | jq .
fi
echo ""

# TEST 11: Try to access as non-admin (should fail)
echo "TEST 11: Access Admin Payment Endpoint as Customer (should fail)"
FORBIDDEN=$(curl -s -X GET http://localhost:3000/api/admin/payments \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
echo "$FORBIDDEN" | jq .
echo ""

# TEST 12: Health check
echo "TEST 12: Health Check"
HEALTH=$(curl -s -X GET http://localhost:3000/health)
echo "$HEALTH" | jq .
echo ""

echo "=========================================="
echo "PHASE 3 Test Suite Complete"
echo "=========================================="
