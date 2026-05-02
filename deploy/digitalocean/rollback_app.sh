#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   APP_DIR=/opt/nexus-erp-deploy TARGET_COMMIT=<commit-sha-or-tag> bash rollback_app.sh

APP_DIR="${APP_DIR:-/opt/nexus-erp-deploy}"
TARGET_COMMIT="${TARGET_COMMIT:-}"

if [[ -z "${TARGET_COMMIT}" ]]; then
  echo "ERROR: TARGET_COMMIT is required."
  exit 1
fi

cd "${APP_DIR}"

git fetch --all --prune
git checkout "${TARGET_COMMIT}"

docker compose build
docker compose up -d

echo "Rollback completed to ${TARGET_COMMIT}"
