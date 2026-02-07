#!/bin/bash
# Redeploy after you push changes to GitHub (or after re-upload). Keeps existing .env.
# Usage: on server, cd to project root and run: bash update.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  Updating & Rebuilding"
echo "========================================"

# Pull latest from Git (if this directory is a clone)
if git rev-parse --git-dir >/dev/null 2>&1; then
  echo "[1/2] Pulling latest from Git..."
  git pull
else
  echo "[1/2] Not a git repo, skipping pull (using current files)."
fi

# Rebuild and restart containers (keeps .env and volumes)
echo "[2/2] Rebuilding and restarting containers..."
export $(grep -v '^#' .env 2>/dev/null | xargs)
docker compose up -d --build

echo ""
echo "Update complete. Containers restarted."
