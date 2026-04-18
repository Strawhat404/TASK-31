#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== RoadSafe Test Suite ==="

# ─── Bring up the stack ──────────────────────────────────────────────────────
echo "[setup] Starting Docker Compose stack..."
docker compose up -d --wait

cleanup() {
  echo "[cleanup] Stopping Docker Compose stack..."
  docker compose down
}
trap cleanup EXIT

# ─── Reset scheduling state so tests start with clean slots ──────────────────
echo "[setup] Resetting scheduling tables for clean test run..."
docker compose exec -T mysql mysql -uroadsafe -proadsafe_password roadsafe \
  -e "SET FOREIGN_KEY_CHECKS=0; TRUNCATE TABLE bay_capacity_locks; TRUNCATE TABLE maintenance_windows; TRUNCATE TABLE equipment_usage_counters; SET FOREIGN_KEY_CHECKS=1;" 2>/dev/null || true
# Re-seed equipment_usage_counters after truncate
docker compose exec -T mysql mysql -uroadsafe -proadsafe_password roadsafe \
  -e "INSERT IGNORE INTO equipment_usage_counters (equipment_resource_id, tests_since_recalibration) SELECT id, 0 FROM facilities_resources WHERE resource_type = 'equipment';" 2>/dev/null || true

echo "[1/2] Running backend unit tests"
docker compose exec -T backend sh -c 'ln -sfn /app/node_modules /backend/node_modules && node --test --test-force-exit /unit_tests/*.test.js'

echo "[2/2] Running API integration tests"
docker compose exec -T backend sh -c 'ln -sfn /app/node_modules /backend/node_modules && node --test --test-force-exit /API_tests/*.test.js'

echo "=== All tests passed ==="
