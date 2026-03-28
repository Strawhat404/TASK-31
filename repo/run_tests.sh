#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[1/2] Running backend tests"
(
  cd "$SCRIPT_DIR/backend"
  npm test
)

echo "[2/2] Running frontend tests"
(
  cd "$SCRIPT_DIR/frontend"
  npm test
)

echo "All test commands completed."
