# RoadSafe API Specification (Final / Chunk 3)

## Coordinator Scheduling

### POST `/api/coordinator/appointments/schedule`
Role: `Coordinator`, `Administrator`

Request body:
```json
{
  "customer_id": 101,
  "vehicle_type": "heavy_duty",
  "scheduled_at": "2026-04-01T09:30:00Z",
  "notes": "Fleet booking",
  "location_code": "HQ",
  "department_code": "OPS"
}
```

Rules enforced:
- Slot must start on 30-minute boundaries.
- Overbooking blocked by unique lock constraints.
- Required resources per appointment:
  - 1 inspector
  - 1 bay
  - 1 emissions analyzer set
- Heavy-duty routing: bay numbers `3..6` only.
- Recalibration rule: after each 8 tests on an analyzer, reserve a 15-minute maintenance window.

### GET `/api/coordinator/bay-utilization`
Role: authenticated, scope-enforced

Query params:
- `location`
- `department`
- `from` (ISO datetime)
- `to` (ISO datetime)

### GET `/api/coordinator/waiting-room/seats`
Role: authenticated, scope-enforced

### PUT `/api/coordinator/waiting-room/seats`
Role: `Coordinator`, `Administrator`

Request body:
```json
{
  "location_code": "HQ",
  "department_code": "OPS",
  "seats": [
    { "id": 1, "seat_label": "S1", "x_pos": 0, "y_pos": 0, "is_active": true }
  ]
}
```

## Ingestion / ETL

### POST `/api/ingestion/jobs`
Role: `Data Engineer`, `Administrator`

Request body:
```json
{
  "source_system": "csv_drop",
  "job_type": "csv_import",
  "priority": 50,
  "csv_path": "/mnt/share/drop/input.csv",
  "device_export_path": "/mnt/devices/export-001.json",
  "source_path": "/mnt/devices/export-001.json",
  "dataset_name": "inspection_ingest",
  "dependencies": [12, 13],
  "backfill_days": 7
}
```

Behavior:
- Supports priorities and dependency graph.
- Backfill constrained to max 30 days.
- Retries up to 5 with exponential backoff metadata.
- Supports device export ingestion via `job_type=device_export_import` and `device_export_path`.

### POST `/api/ingestion/run-once`
Role: `Data Engineer`, `Administrator`

Runs one queue cycle.

### POST `/api/ingestion/drop-scan`
Role: `Data Engineer`, `Administrator`

Request body:
```json
{
  "drop_path": "/mnt/share/drop",
  "dataset_name": "inspection_ingest",
  "backfill_days": 0
}
```

### GET `/api/ingestion/jobs/:id`
Role: `Data Engineer`, `Administrator`

Returns job row and checkpoints.

## Transformation and Data Quality

Applied transformations:
- Miles -> kilometers (`distance_km`)
- Currency -> USD (`price_usd`)
- Deterministic deduplication keys + similarity threshold

Lineage and quality:
- Writes `dataset_versions` entries with lineage JSON.
- Triggers `quality_alerts` when missing field rate or duplicate rate deviates by >2% from trailing 14-run baseline.

## Search Intelligence

### GET `/api/search/vehicles`
Role: authenticated

Query params:
- `q`
- `brand`
- `model_year`
- `price_min`
- `price_max`
- `energy_type`
- `transmission`
- `page` (25/page)
- `sort_by` (`date` | `status`)
- `sort_order` (`asc` | `desc`)

### GET `/api/search/autocomplete`
Role: authenticated

Query params:
- `prefix`

### GET `/api/search/trending`
Role: authenticated

Returns top keywords from local `search_query_logs` in trailing 7 days.

## Messaging and Outbox

### POST `/api/messages/send`
Role: `Coordinator`, `Administrator`, `Inspector`

Queues in-app message and writes manual delivery payloads to outbox.

### GET `/api/messages/inbox`
Role: authenticated

### POST `/api/messages/outbox/export`
Role: `Coordinator`, `Administrator`, `Data Engineer`

Exports pending payloads and marks them exported.

## Security and Compliance

### POST `/api/files/ingest`
Role: `Coordinator`, `Inspector`, `Data Engineer`, `Administrator`

Controls:
- 50MB max file size
- MIME/extension allowlist
- SHA-256 hash blocklist
- Sensitive-content quarantine using configurable regex and dictionary rules

### GET `/api/files/download/:id`
Role: authenticated

Controls:
- Bearer authorization required
- Scope-based file access enforcement
- Hotlink protection via `Referer` validation against configured frontend origin
- Returns file stream with attachment disposition

### POST `/api/compliance/account-closure`
Role: authenticated

Creates anonymization request due in 30 days.

### POST `/api/compliance/retention/run`
Role: `Administrator`, `Data Engineer`

Runs retention sweep:
- Tombstones reports older than 7 years.
- Completes due account anonymizations while preserving audit history.

## Transport Security

- TLS is enabled by default in containerized production startup.
- Backend requires certificate and key paths when TLS is enabled.
