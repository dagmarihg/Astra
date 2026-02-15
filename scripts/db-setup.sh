#!/usr/bin/env bash
set -euo pipefail

# Simple DB setup script for local/VPS
# Usage: DB_USER=postgres DB_NAME=astra ./scripts/db-setup.sh

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-astra}"
DB_PASSWORD="${DB_PASSWORD:-}"

echo "[db-setup] Using host=${DB_HOST} port=${DB_PORT} user=${DB_USER} db=${DB_NAME}"

export PGPASSWORD="${DB_PASSWORD}"

echo "Creating database if not exists..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -c "CREATE DATABASE \"${DB_NAME}\";"

echo "Applying schema.sql..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f backend/db/schema.sql

echo "Applying seed-plans.sql..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f backend/db/seed-plans.sql

echo "Done."
