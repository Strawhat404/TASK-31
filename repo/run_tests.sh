#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== RoadSafe Test Suite ==="

echo "[1/2] Running backend unit tests"
docker compose exec -T backend node --test /unit_tests/*.test.js

echo "[2/2] Running API integration tests"
docker compose exec -T backend node --test /API_tests/*.test.js

echo "=== All tests passed ==="
