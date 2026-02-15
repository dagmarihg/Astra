#!/usr/bin/env bash
set -euo pipefail

if [ -z "${ADMIN_TOKEN:-}" ]; then
  echo "Please export ADMIN_TOKEN with a valid admin JWT to run this test"
  exit 2
fi

node tests/multi_client_realtime_test.js
