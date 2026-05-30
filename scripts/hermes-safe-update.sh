#!/bin/bash
#
# Safe update script for the Polymarket MCP when used with Hermes.
#
# This script updates the MCP code from git and rebuilds it.
# It does NOT touch your Hermes configuration or credentials.
#
# Usage:
#   ./scripts/hermes-safe-update.sh
#
# After running this, in your Hermes session run:
#   /reload-mcp
#

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Updating Polymarket MCP (safe mode for Hermes)"
echo "==> Repo: $REPO_ROOT"
echo ""

# Pull latest code
echo "==> Pulling latest changes from git..."
git pull --ff-only || {
  echo "Warning: Could not fast-forward. You may have local changes."
  echo "Please resolve manually if needed."
  exit 1
}

# Install deps and build
echo "==> Installing dependencies..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
else
  npm install
fi

echo "==> Building MCP..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm build
else
  npm run build
fi

echo ""
echo "==> Update complete."
echo ""
echo "IMPORTANT: Your Hermes configuration and private keys were NOT touched."
echo ""
echo "Next steps:"
echo "  1. In your Hermes session, run: /reload-mcp"
echo "  2. (Recommended) Start a fresh session after reloading."
echo ""
echo "If you want to change which tools are enabled, run:"
echo "  hermes mcp configure polymarket"
echo ""
