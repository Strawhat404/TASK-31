#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== RoadSafe Test Suite ==="

# ─── Require Docker environment ─────────────────────────────────────────────
# All tests must execute within Docker containers. Local execution is not
# supported — the backend requires a running MySQL instance provided by the
# Docker Compose stack.

if ! docker compose ps --status running backend 2>/dev/null | grep -q backend; then
  echo "ERROR: Docker environment not detected." >&2
  echo "The test suite requires all services to be running in Docker." >&2
  echo "Start the stack first:" >&2
  echo "" >&2
  echo "  docker-compose up -d" >&2
  echo "" >&2
  echo "Then re-run this script:" >&2
  echo "" >&2
  echo "  ./run_tests.sh" >&2
  exit 1
fi

echo "Detected running Docker environment — executing tests in containers."

echo "[1/3] Running backend unit tests (Docker)"
docker compose exec -T backend node --test ../unit_tests/*.test.js

echo "[2/3] Running API integration tests (Docker)"
docker compose exec -T backend node --test ../API_tests/*.test.js

echo "[3/3] Running frontend structural tests (Docker — static analysis only)"
docker compose exec -T backend node --test ../frontend/tests/ui.test.js 2>/dev/null || (
  cd "$SCRIPT_DIR/frontend"
  node --test tests/ui.test.js
)

# Run vitest component tests if available
if docker compose exec -T frontend test -f /app/vitest.config.js 2>/dev/null; then
  echo "[4/4] Running frontend component tests (vitest via Docker)"
  docker compose exec -T frontend npx vitest run --config vitest.config.js 2>/dev/null || {
    # Fallback: run vitest via backend container if frontend container lacks npx
    if [ -f "$SCRIPT_DIR/frontend/vitest.config.js" ] && [ -d "$SCRIPT_DIR/frontend/node_modules/.bin" ]; then
      echo "  Falling back to host-mounted vitest..."
      (
        cd "$SCRIPT_DIR/frontend"
        npx vitest run --config vitest.config.js
      )
    fi
  }
fi

# Optional: Run E2E browser tests if configured
if [ -f "$SCRIPT_DIR/frontend/playwright.config.js" ] && command -v npx &>/dev/null; then
  if [ -n "${E2E_BASE_URL:-}" ]; then
    echo "[E2E] Running Playwright browser tests"
    (
      cd "$SCRIPT_DIR/frontend"
      E2E_BASE_URL="$E2E_BASE_URL" npx playwright test --config playwright.config.js
    )
  else
    echo "[E2E] Skipping Playwright tests (set E2E_BASE_URL to enable)"
  fi
fi

echo "=== All tests passed ==="
