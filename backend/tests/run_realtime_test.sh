#!/usr/bin/env bash
set -euo pipefail

echo "Starting realtime listener..."
node tests/realtime_listener.js &
LISTENER_PID=$!

sleep 1

echo "Triggering dev emit (requires server running in development mode)..."
curl -s -X POST http://localhost:3000/api/dev/emit -H "Content-Type: application/json" -d '{"event":"test:event","payload":{"msg":"hello from test"}}' | jq . || true

sleep 2

kill $LISTENER_PID || true
echo "Realtime test completed."
