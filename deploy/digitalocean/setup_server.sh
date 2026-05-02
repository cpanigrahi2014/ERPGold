#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   sudo DOMAIN=demo.example.com APP_USER=nexus APP_DIR=/opt/nexus-erp-deploy bash setup_server.sh
# Notes:
# - Run on a fresh Ubuntu 22.04/24.04 DigitalOcean droplet
# - Creates app user, installs Docker + Compose plugin, hardens firewall, and prepares folders

DOMAIN="${DOMAIN:-}"
APP_USER="${APP_USER:-nexus}"
APP_DIR="${APP_DIR:-/opt/nexus-erp-deploy}"
SSH_PORT="${SSH_PORT:-22}"

if [[ -z "${DOMAIN}" ]]; then
  echo "ERROR: DOMAIN is required. Example: DOMAIN=demo.yourdomain.com"
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root (or with sudo)."
  exit 1
fi

echo "[1/7] Updating OS packages"
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg lsb-release ufw git jq

echo "[2/7] Installing Docker Engine + Compose plugin"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker

echo "[3/7] Creating app user (${APP_USER})"
if ! id "${APP_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${APP_USER}"
fi
usermod -aG docker "${APP_USER}"

echo "[4/7] Preparing app directories"
mkdir -p "${APP_DIR}"
mkdir -p /opt/nexus-reverse-proxy
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "[5/7] Configuring firewall"
ufw allow "${SSH_PORT}/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "[6/7] Writing Caddy reverse proxy config"
cat > /opt/nexus-reverse-proxy/Caddyfile <<EOF
${DOMAIN} {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3010
}
EOF

echo "[7/7] Starting Caddy for automatic TLS"
docker rm -f nexus-caddy >/dev/null 2>&1 || true
docker run -d \
  --name nexus-caddy \
  --restart unless-stopped \
  -p 80:80 -p 443:443 \
  -v /opt/nexus-reverse-proxy/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v caddy_data:/data \
  -v caddy_config:/config \
  caddy:2

echo "Server bootstrap complete."
echo "Next steps:"
echo "1) Point DNS A record: ${DOMAIN} -> this droplet public IP"
echo "2) Run deploy_app.sh as ${APP_USER}"
