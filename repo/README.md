# RoadSafe Inspection Operations Platform

**Project type:** fullstack

Vehicle inspection platform built with Vue 3, Koa.js, and MySQL. Supports multi-role workflows across administrators, coordinators, inspectors, customers, and data engineers, with scope-restricted access enforced at the API level.

---

## Quick Start

### Prerequisites

- Docker with Compose support

### Start All Services

```bash
docker-compose up
```

`docker compose up` (without the hyphen) also works on newer Docker versions.

Once running, all services are available via the URLs listed below.

---

## Services

| Service | URL |
|---|---|
| Frontend + API (Caddy TLS proxy) | https://localhost |
| Backend direct | http://localhost:4000 |

The Caddy proxy handles TLS termination and routes `/api/*` requests to the backend. The frontend is served at the root. Accept the self-signed certificate in your browser on first visit.

---

## Demo Credentials

Authentication is required.

The administrator account is created automatically on first startup. The remaining demo accounts are created from inside the running backend container:

```bash
docker compose exec backend node seed-demo-users.js
```

| Role | Username | Password |
|---|---|---|
| Administrator | admin | Admin@123456 |
| Coordinator | coordinator | Coordinator@123 |
| Inspector | inspector | Inspector@1234 |
| Customer | customer | Customer@12345 |
| Data Engineer | dataengineer | DataEngineer@123 |

If you need all non-admin roles available for verification, run the seed command after `docker-compose up` completes.

---

## Roles and Permissions

- **Administrator**: Full platform access. Manages users, views audit logs, accesses all dashboards, security configuration, and data ingestion.
- **Coordinator**: Schedules appointments, manages waiting room seats, sends messages. Scoped to their assigned location and department.
- **Inspector**: Views assigned inspection queue, publishes inspection results. Scoped to their assigned location.
- **Data Engineer**: Manages data ingestion jobs, views ingestion health, accesses security configuration. Scoped to their location.
- **Customer**: Views own vehicles and published inspection reports. Limited self-service access.

All non-admin roles are scope-restricted by `location_code` and `department_code`. Attempts to access resources outside the assigned scope are rejected at the API level.

---

## Verification

### API health check

```bash
# Health check
curl -k https://localhost/health

# Admin login
curl -k -X POST https://localhost/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@123456"}'

# Expected: {"token":"...","user":{...}}
```

### Frontend verification

1. Open https://localhost in a browser and accept the self-signed certificate.
2. Login with `admin` / `Admin@123456`.
3. The dashboard shows metric cards for appointments, inspections, and resources.
4. Navigate to User Management, Search, and Coordinator views from the sidebar.

### Role verification

1. Run `docker compose exec backend node seed-demo-users.js` if the non-admin demo accounts have not been created yet.
2. Login as `coordinator` / `Coordinator@123` and verify Scheduling, Waiting Room Seats, and Messaging are available.
3. Login as `inspector` / `Inspector@1234` and verify the inspection queue and result publishing workflow are available.
4. Login as `customer` / `Customer@12345` and verify the customer report view is available.
5. Login as `dataengineer` / `DataEngineer@123` and verify ingestion and security configuration views are available.

---

## Usage Workflows

### Admin workflow

1. Login as `admin`.
2. Go to User Management > Add User to create accounts for other roles.
3. Go to Audit Logs to review platform activity.
4. Use Search to find vehicle records.

### Coordinator workflow

1. Login as `coordinator`.
2. Go to Scheduling > Create Appointment.
3. Manage Waiting Room Seats.
4. Send Messages to inspectors or customers.

### Inspector workflow

1. Login as `inspector`.
2. Go to Inspections to view the assigned queue.
3. Click "Publish Result" on an appointment.
4. Fill in outcome (pass / fail / recheck), score, and findings.

### Customer workflow

1. Login as `customer`.
2. View "My Reports" to see published inspection results.

---

## Architecture

### Request Flow

```
Browser (HTTPS)
    │
    ▼
┌─────────────────────┐
│  Caddy TLS Proxy    │  ← Trust boundary: TLS termination
│  (port 443/80)      │     Self-signed cert for local dev
└─────────┬───────────┘
          │ HTTP (internal Docker network)
          ├──── /api/*  ──────────────┐
          │                           ▼
          │                  ┌─────────────────────┐
          │                  │  Koa.js Backend      │
          │                  │  (port 4000)         │
          │                  │                      │
          │                  │  Middleware chain:    │
          │                  │  CORS → Error handler │
          │                  │  → Body parser        │
          │                  │  → Auth (optional)    │
          │                  │  → CSRF validation    │
          │                  │  → Rate limiter       │
          │                  │  → Route handlers     │
          │                  └─────────┬────────────┘
          │                            │ mysql2
          │                            ▼
          │                  ┌─────────────────────┐
          │                  │  MySQL 8.4           │
          │                  │  (port 3306)         │
          │                  │  Schema: roadsafe    │
          │                  └─────────────────────┘
          │
          └──── /*  ─────────────────┐
                                     ▼
                            ┌─────────────────────┐
                            │  Nginx (Frontend)    │
                            │  Vue 3 SPA           │
                            │  (port 80)           │
                            └─────────────────────┘
```

### Trust Boundaries

1. **Caddy → Backend**: Internal Docker network. TLS is terminated at Caddy; backend runs plain HTTP. The backend enforces `TLS_ENABLED=true` in production when Caddy is not present.
2. **Backend → MySQL**: Connection pool with credentials from environment variables. Parameterized queries prevent SQL injection.
3. **Browser → Caddy**: Self-signed TLS certificate for local development. Browser must accept the certificate on first visit.
4. **CSRF**: Mutations (POST/PUT/PATCH/DELETE) require the Bearer token echoed in the `X-CSRF-Token` header.
5. **Scope enforcement**: All non-admin API requests are filtered by `location_code` and `department_code` at the middleware layer.

---

## Known Limitations

- **Self-signed TLS**: The Caddy proxy generates a self-signed certificate for `localhost`. Browsers will show a security warning on first visit. Accept the certificate to proceed. Automated tools (curl, fetch) require `--insecure` / `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- **Single-node deployment**: The architecture is designed for single-host Docker Compose. Rate limiting uses in-memory counters that are not shared across instances.
- **Session storage**: Sessions are stored in MySQL. There is no Redis or distributed cache layer.
- **Ingestion scheduler**: The hourly ingestion job uses `node-cron` with a `setInterval` fallback. Job state is stored in MySQL — if the backend restarts, in-flight jobs may need manual recovery.
- **File storage**: File ingest operations validate against a configurable drop zone path (`/var/roadsafe/dropzone`). Files are not stored in object storage.
- **Encryption key**: The `DATA_ENCRYPTION_KEY` environment variable in `docker-compose.yml` is a placeholder. Replace it with a real 64-character hex key before any production use.

---

## Project Structure

```
repo/
├── backend/           # Koa.js API server (Node.js 20)
│   ├── src/
│   │   ├── app.js          # Koa app factory (exportable)
│   │   ├── server.js       # Bootstrap and listen
│   │   ├── config.js       # Environment config
│   │   ├── db.js           # MySQL connection pool
│   │   ├── middleware/      # auth, rbac, rateLimit
│   │   ├── routes/          # 14 route files
│   │   ├── services/        # Business logic services
│   │   └── utils/           # Audit, encryption, redaction
│   ├── init.sql             # Database schema + seed data
│   └── Dockerfile
├── frontend/          # Vue 3 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── App.vue          # Root component
│   │   ├── components/      # 10 feature components
│   │   └── services/api.js  # HTTP client
│   └── Dockerfile
├── unit_tests/        # Backend unit tests (Node.js test runner)
├── API_tests/         # API integration tests
│   └── helpers/setup.js  # Shared test harness (self-bootstrapping)
├── docker-compose.yml # Container orchestration
├── Caddyfile          # TLS reverse proxy config
└── run_tests.sh       # Test runner (Docker-aware)
```

---

## Testing

### Running tests (Docker required)

```bash
docker-compose up -d
./run_tests.sh
```

The test suite requires a running Docker Compose stack. The `run_tests.sh` script will exit with an error if the backend container is not running. Do not use local package installation (`npm install`) for test execution — all backend and API tests run inside Docker containers against the real MySQL instance.

### Test suites

- **Backend unit tests** (`unit_tests/`): Pure function coverage for middleware and selected services.
- **API integration tests** (`API_tests/`): HTTP tests covering the backend endpoint surface through the real Koa routing layer.
- **Frontend structural tests** (`frontend/tests/ui.test.js`): Static structural assertions for Vue components and API integration points.
- **Frontend component tests** (`frontend/tests/components/`): Vitest + Vue Test Utils component coverage.
- **Browser E2E tests** (`frontend/tests/e2e/`): Playwright browser flows for full frontend to backend verification.

Use `./run_tests.sh` from the repository root to execute the supported test workflow.
