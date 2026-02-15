#!/bin/bash

# Astra PHASE 4 Test Setup & Execution

set -e

echo "=========================================="
echo "Astra PHASE 4 - Test Setup"
echo "=========================================="
echo ""

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-astra}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"

echo "Checking prerequisites..."
echo ""

# Check if postgres is running
if ! psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; then
  echo "⚠️  PostgreSQL is not accessible"
  echo "   Please start PostgreSQL: sudo service postgresql start"
  exit 1
fi
echo "✓ PostgreSQL is accessible"

# Check if redis/backend is running
if ! curl -s http://localhost:$BACKEND_PORT/api/me >/dev/null 2>&1; then
  echo "⚠️  Backend server not running on port $BACKEND_PORT"
  echo "   Start backend: cd backend && npm start"
  exit 1
fi
echo "✓ Backend server is running"

# Check if frontend is running
if ! curl -s http://localhost:$FRONTEND_PORT/ >/dev/null 2>&1; then
  echo "⚠️  Frontend server not running on port $FRONTEND_PORT"
  echo "   Start frontend: cd frontend/public && node server.js"
  exit 1
fi
echo "✓ Frontend server is running"
echo ""

echo "Seeding database with test plans..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Seed test plans if they don't exist
INSERT INTO plans (name, description, price, duration_days, cpu_cores, ram_gb, storage_gb, max_players, is_active)
VALUES 
  ('Starter', 'Perfect for beginners', 4.99, 30, 2, 2.0, 10.0, 20, true),
  ('Standard', 'For growing communities', 9.99, 30, 4, 4.0, 20.0, 50, true),
  ('Professional', 'For admins', 14.99, 30, 6, 8.0, 50.0, 100, true),
  ('Enterprise', 'Maximum performance', 24.99, 30, 8, 16.0, 100.0, 500, true)
ON CONFLICT DO NOTHING;

-- Show plans
SELECT COUNT(*) as plan_count FROM plans;
EOF

echo "✓ Database seeded"
echo ""

echo "=========================================="
echo "Running PHASE 4 Test Suite"
echo "=========================================="
echo ""

# Run the actual test
cd /workspaces/Astra
bash test-phase4.sh
TEST_EXIT_CODE=$?

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED!"
  echo ""
  echo "Next steps:"
  echo "  - Review test results"
  echo "  - Proceed to PHASE 5: Email Notifications"
else
  echo "❌ Some tests failed (exit code: $TEST_EXIT_CODE)"
  echo ""
  echo "Troubleshooting:"
  echo "  - Check backend logs: tail -f /workspaces/Astra/backend/server.log"
  echo "  - Check frontend logs: tail -f /workspaces/Astra/frontend/public/server.log"
  echo "  - Check database: psql -U postgres -d astra"
fi

exit $TEST_EXIT_CODE
