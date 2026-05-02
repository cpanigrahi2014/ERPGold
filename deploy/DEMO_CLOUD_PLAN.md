# NEXUS ERP Demo Cloud Deployment Plan (Cost-Optimized)

## Platform Decision

Recommended for demo: DigitalOcean

Why:
- Faster setup with lower ops complexity
- Predictable monthly pricing
- Easy Docker Compose based deployment
- Best fit for short customer demo timeline

Use AWS only if customer mandates AWS. If required, use AWS Lightsail (not full multi-service AWS setup) for simpler cost control.

## Cost Snapshot (Approximate)

- DigitalOcean Droplet (4 vCPU, 8 GB RAM): around 48 USD/month
- Backups/Snapshots: around 10 USD/month
- Total demo infra estimate: around 58 to 65 USD/month

Equivalent AWS EC2 based demo usually ends up higher after compute + storage + transfer + extra setup overhead.

## Demo Architecture

- 1 Ubuntu droplet
- Docker + Docker Compose for full stack
- Caddy container for HTTPS and reverse proxy
- DNS A record to droplet public IP
- Daily droplet backup enabled

## Deployment Files Added

- deploy/digitalocean/setup_server.sh
- deploy/digitalocean/deploy_app.sh
- deploy/digitalocean/rollback_app.sh

## Preconditions

- Domain/subdomain available (example: demo.yourcompany.com)
- SSH key registered in DigitalOcean
- Git repository URL accessible from droplet

## Step-by-Step Commands

### 1) Create Droplet

- Region close to customer
- Ubuntu 22.04 or 24.04
- Size: 4 vCPU / 8 GB RAM
- Enable backups
- Add SSH key

### 2) Bootstrap Server (as root)

scp deploy/digitalocean/setup_server.sh root@DROPLET_IP:/root/
ssh root@DROPLET_IP
chmod +x /root/setup_server.sh
DOMAIN=demo.yourcompany.com APP_USER=nexus APP_DIR=/opt/nexus-erp-deploy /root/setup_server.sh

### 3) Point DNS

- Create A record: demo.yourcompany.com -> DROPLET_IP
- Wait for DNS propagation (usually a few minutes)

### 4) Deploy Application (as nexus user)

ssh nexus@DROPLET_IP
scp deploy/digitalocean/deploy_app.sh nexus@DROPLET_IP:/opt/nexus-erp-deploy/
chmod +x /opt/nexus-erp-deploy/deploy_app.sh
REPO_URL=https://github.com/ORG/REPO.git REPO_BRANCH=main APP_DIR=/opt/nexus-erp-deploy bash /opt/nexus-erp-deploy/deploy_app.sh

### 5) Verify

docker compose ps
curl -I https://demo.yourcompany.com

Open in browser:
- https://demo.yourcompany.com
- Validate key journeys: login, records, notifications, one end-to-end flow

## Demo Day Runbook

- Rebuild and restart stack 1 hour before demo
- Verify health endpoints and login path
- Keep one pre-seeded data scenario ready
- Keep rollback commit prepared

## Rollback

scp deploy/digitalocean/rollback_app.sh nexus@DROPLET_IP:/opt/nexus-erp-deploy/
ssh nexus@DROPLET_IP
chmod +x /opt/nexus-erp-deploy/rollback_app.sh
APP_DIR=/opt/nexus-erp-deploy TARGET_COMMIT=<last-good-commit> bash /opt/nexus-erp-deploy/rollback_app.sh

## Security Minimum

- Only open ports 22, 80, 443
- Use SSH keys only (disable password auth)
- Keep DB ports private
- Store secrets in environment files on server
- Enable backups before customer demo

## AWS Alternative (If Required)

Recommended AWS path for demo: Lightsail

- 4 vCPU / 8 GB instance
- Same Docker Compose approach
- Same scripts can be used with minor path changes
- Higher ops friction compared to DigitalOcean, but acceptable if AWS is mandatory
