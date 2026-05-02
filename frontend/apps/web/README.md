# NEXUS Web Console (React)

Modern, animated single-page console for the 10-module NEXUS ERP. Replaces
the previous static `admin-standalone/index.html` while talking to the
exact same backend APIs.

## Stack
- React 18 + TypeScript + Vite 5
- Tailwind CSS (custom dark "aurora" theme)
- Framer Motion (page transitions, sidebar pill, toast stack, hover lifts)
- React Router 6 (nested routes + per-route role guard)
- Zustand (auth + toasts; persisted to `localStorage`)
- Lucide icons

## Role-based access
Roles live in [src/modules/registry.ts](src/modules/registry.ts). Each
module declares the roles allowed to see/use it:

| Module          | Roles                                              |
|-----------------|----------------------------------------------------|
| Admin / Masters | `ADMIN`                                            |
| Inventory       | `ADMIN`, `MANAGER`, `INVENTORY_CLERK`              |
| Testing         | `ADMIN`, `MANAGER`, `INVENTORY_CLERK`              |
| Hallmarking     | `ADMIN`, `MANAGER`, `HM_OPERATOR`                  |
| Laser           | `ADMIN`, `MANAGER`, `HM_OPERATOR`                  |
| Refinery        | `ADMIN`, `MANAGER`, `REFINER`                      |
| Exchange        | `ADMIN`, `MANAGER`, `BILLING_CLERK`                |
| Billing         | `ADMIN`, `MANAGER`, `BILLING_CLERK`                |
| Records         | `ADMIN`, `MANAGER`, `BILLING_CLERK`, `VIEWER`      |
| Notifications   | `ADMIN`, `MANAGER`                                 |

Sidebar entries are filtered automatically. Direct URL navigation to a
forbidden module redirects to `/dashboard` via `RequireModule`.

## Auth
- If the admin backend runs in **standalone** mode the login screen lets
  the user pick a role and skips the password (matches existing behaviour).
- Otherwise it `POST /api/admin/api/v1/admin/auth/login` and stores the
  returned JWT in `localStorage` (Zustand `persist`).
- All subsequent calls send `Authorization: Bearer <token>` automatically.

## Dev
```bash
npm install
npm run dev    # http://localhost:3010 — proxies to local backend ports
```

## Production (Docker)
Built by the root `docker compose up -d` via the `web` service. The image
is multi-stage (`node:20-alpine` → `nginx:1.27-alpine`) and the bundled
nginx reverse-proxies `/api/<module>/` to each backend container, so the
browser stays single-origin.
