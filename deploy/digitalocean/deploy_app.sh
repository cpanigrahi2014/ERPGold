#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   REPO_URL=https://github.com/<org>/<repo>.git REPO_BRANCH=main APP_DIR=/opt/nexus-erp-deploy bash deploy_app.sh
# Optional:
#   COMPOSE_PROFILES=demo bash deploy_app.sh

REPO_URL="${REPO_URL:-}"
REPO_BRANCH="${REPO_BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/nexus-erp-deploy}"
COMPOSE_PROFILES="${COMPOSE_PROFILES:-}"

if [[ -z "${REPO_URL}" ]]; then
  echo "ERROR: REPO_URL is required."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed. Run setup_server.sh first."
  exit 1
fi

mkdir -p "${APP_DIR}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "Cloning repository into ${APP_DIR}"
  git clone "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"

echo "Fetching latest code"
git fetch --all --prune
git checkout "${REPO_BRANCH}"
git pull origin "${REPO_BRANCH}"

# Keep a release marker for quick rollback
mkdir -p .deploy
RELEASE_ID="$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
echo "${RELEASE_ID}" > .deploy/current_release
cp -f docker-compose.yml ".deploy/docker-compose-${RELEASE_ID}.yml"

COMPOSE_CMD=(docker compose)
if [[ -n "${COMPOSE_PROFILES}" ]]; then
  COMPOSE_CMD+=(--profile "${COMPOSE_PROFILES}")
fi

echo "Building images"
"${COMPOSE_CMD[@]}" build

echo "Starting stack"
"${COMPOSE_CMD[@]}" up -d

echo "Pruning dangling images"
docker image prune -f >/dev/null 2>&1 || true

echo "Health snapshot"
"${COMPOSE_CMD[@]}" ps

echo "Deployment complete: ${RELEASE_ID}"
