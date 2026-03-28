# RoadSafe Inspection Operations Platform

Full-stack offline-first platform using:
- Backend: Node.js + Koa
- Frontend: Vue 3 + Vite
- Database: MySQL

## One-Click Startup

```bash
cd repo
docker compose up --build -d
```

Services:
- Backend API: `http://localhost:4000`
- Frontend UI: `http://localhost:5173`

Default bootstrap admin credentials:
- Username: `admin`
- Password: `Admin@123456`

## Run Full Test Suite

From the `repo/` directory:

```bash
./run_tests.sh
```

This orchestrates both backend and frontend test commands.

## Feature Coverage

- Coordinator scheduling with strict no-overbooking locks
- Recalibration automation after every 8 emissions tests
- ETL ingestion queue with priorities, dependencies, retries, checkpoints, lineage and anomaly alerts
- Faceted search + autocomplete + trending keywords
- Messaging center + manual SMS/Email outbox export
- AES-256 encryption helpers, identifier redaction defaults, file governance/quarantine, retention/anonymization workflows
