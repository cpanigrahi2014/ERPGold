# NEXUS ERP — Standalone Deployment

Single-customer, self-contained deployment of the **NEXUS Jewellery ERP**.
Ten independent Spring Boot services + ten PostgreSQL instances + a unified web console — all brought up with **one Docker Compose command**.

---

## Modules

| # | Module            | API Port | Purpose                                              |
|---|-------------------|----------|------------------------------------------------------|
| 1 | Admin / Masters   | 8084     | Tenants, branches, users, customers, products, rates |
| 2 | Inventory         | 8085     | Lots, locations, stock ledger                        |
| 3 | Testing           | 8086     | Purity testing jobs & certificates                   |
| 4 | Hallmarking       | 8087     | BIS hallmarking jobs, dispatches, HUID               |
| 5 | Laser Marking     | 8088     | Laser machines & engraving jobs                      |
| 6 | Refinery          | 8089     | Refining batches, recovery, fineness, loss           |
| 7 | Exchange          | 8090     | Old-gold exchange & settlement                       |
| 8 | Billing           | 8091     | GST invoices, payments, balance tracking             |
| 9 | Business Records  | 8092     | Day book, audit trail, statutory registers           |
| 10| Notifications     | 8093     | Email / SMS / Webhook templates & dispatch           |

Web console: **http://localhost:3010** (React SPA — see [frontend/apps/web](frontend/apps/web/README.md))

---

## Prerequisites

- Docker Desktop (or Docker Engine 24+) with Compose v2
- ~8 GB free RAM
- ~5 GB free disk (images + initial volumes)

That's it. **No JDK, Maven, Node, or pnpm needed on the host** — every service is built inside its own container.

---

## Deploy

```bash
docker compose up -d
```

First run takes 5–10 minutes (Maven downloads + image builds). Subsequent runs are instant.

### Verify everything is healthy

```powershell
pwsh ./test_integration.ps1
```

Expected: **19/19 PASS**.

### Tear down

```bash
docker compose down            # stop, keep data
docker compose down -v         # stop and wipe all DB volumes (clean slate)
```

---

## Default Credentials

```
Email:    admin@nexus.local
Password: admin123
```

Each service also runs in **standalone mode** by default (`<MODULE>_STANDALONE=true`) which permits unauthenticated calls stamped against the default tenant — convenient for first-customer demos. Set the flag to `false` to enforce JWT.

---

## Endpoints

Every backend exposes:

- `/actuator/health` — Spring Boot health endpoint
- `/swagger-ui.html` — interactive REST docs

Example:
- http://localhost:8084/swagger-ui.html (Admin)
- http://localhost:8091/swagger-ui.html (Billing)

---

## Architecture

- **Java 21 + Spring Boot 3.3** for every backend
- **PostgreSQL 17-alpine** per module (data isolation)
- **Flyway** schema migrations on startup
- **Multi-stage Docker builds** with Maven dependency cache
- **JPA `ddl-auto: validate`** — schema is owned by Flyway, never auto-mutated
- Common building blocks (BaseEntity, TenantContext, JWT helpers) live in `nexus-common` and are pulled in by every service

---

## Repo Layout

```
backend/
  pom.xml                          # parent multi-module Maven build
  Dockerfile.<module>              # per-module multi-stage build
  nexus-common/                    # shared entity base, security, utils
  nexus-admin/  ... nexus-notifications/   # 10 service modules
frontend/
  apps/admin-standalone/           # unified web console (static HTML+JS, served by nginx)
docker-compose.yml                 # one-shot deployment of all 21 containers
test_integration.ps1               # 19-check smoke / integration test
```

---

## Customisation

Tune environment variables in `docker-compose.yml`:

| Variable                          | Default                | Meaning                                  |
|-----------------------------------|------------------------|------------------------------------------|
| `<MODULE>_STANDALONE`             | `true`                 | Permit anonymous calls (demo mode)       |
| `JWT_SECRET`                      | (provided dev key)     | Override for production                  |
| `CORS_ORIGINS`                    | `http://localhost:3010`| Comma-separated allowed origins          |
| `DB_PASSWORD`                     | `nexus_dev_2026`       | Postgres password                        |
| `DISPATCH_SIMULATE` (Notifications)| `true`                | Set `false` to wire real SMTP/SMS gateway|

For production:
1. Change `JWT_SECRET` and `DB_PASSWORD`
2. Set every `<MODULE>_STANDALONE=false`
3. Put a TLS-terminating reverse proxy in front of port 3010 / 808x

---

## License

Proprietary — © NEXUS ERP. All rights reserved.
