#!/usr/bin/env bash
set -euo pipefail

echo "Starting two instances to test advisory lock leader election..."

node tests/leader_election_instance.js instA 8000 &
PID_A=$!
sleep 0.2
node tests/leader_election_instance.js instB 2000 &
PID_B=$!

wait $PID_A
wait $PID_B

echo "Leader election test complete."
