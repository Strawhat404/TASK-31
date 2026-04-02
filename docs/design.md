# RoadSafe Inspection Operations Platform - System Design

## Overview

RoadSafe is a full-stack offline-first vehicle inspection operations platform designed for regional inspection providers operating on internal networks. The system manages catalog, scheduling, reporting, and compliance workflows across five primary user roles.

## Architecture

### Technology Stack

**Frontend:**
- Vue 3 (Composition API)
- Tailwind CSS
- Vite build system
- Single-page application (SPA)

**Backend:**
- Node.js with Koa framework
- RESTful API architecture
- MySQL database
- Docker containerization

**Security:**
- HTTPS with TLS certificates
- AES-256 encryption for sensitive data
- JWT bearer token authentication
- Rate limiting and CSRF protection

## System Components

### 1. User Management & Authentication

**Roles:**
- Administrator: System configuration, user management, full access
- Data Engineer: Ingestion pipeline management
- Coordinator: Scheduling, resource allocation
- Inspector: Test execution, result publication
- Customer: Search, view own reports

**Authentication Flow:**
- Username/password login
- JWT token generation
- Session persistence in localStorage
- Role-based access control (RBAC)

**Security Features:**
- Password requirements: 12+ characters with complexity
- Salted password hashing
- Rate limiting: 60 req/min per user, 300 req/min per IP
- Privilege escalation detection
- Immutable audit logs (2-year retention)

### 2. Dashboard & Metrics

**Landing Page Displays:**
- Today's appointments count and list
- Upcoming appointments
- Total inspections
- Resource utilization (bays, equipment)
- Ingestion job health (queued, running, failed)

**Resource Utilization:**
- Real-time bay occupancy tracking
- Equipment availability monitoring
- Visual progress indicators

### 3. Scheduling System

**Coordinator Features:**
- Appointment creation with customer/vehicle details
- 30-minute time slot boundaries
- Overbooking prevention via unique constraints
- Waiting room seat management with visual layout

**Resource Allocation Rules:**
- 1 inspector per appointment
- 1 bay per appointment
- 1 emissions analyzer set per appointment
- Heavy-duty vehicles: Bays 3-6 only
- Analyzer recalibration: 15-min maintenance after every 8 tests

**Waiting Room Management:**
- Configurable seat layouts (x/y positioning)
- Seat-to-appointment assignment
- Visual seat status indicators

### 4. Search Intelligence

**Search Capabilities:**
- Keyword search (brand, model, plate)
- Advanced filters:
  - Brand
  - Model year
  - Price range (USD)
  - Energy type (petrol, diesel, hybrid, electric, CNG)
  - Transmission (manual, automatic, CVT)
  - Date range
- Pagination (25 results per page)
- Sorting (date, status)

**Smart Features:**
- Autocomplete suggestions
- Trending keywords (7-day rolling window)
- Query logging for analytics
- Scope-based result filtering (location/department)

### 5. Data Ingestion Pipeline

**Connector Framework:**
- Plugin-based architecture
- Supported sources:
  - CSV file drops
  - Network share enumeration
  - Device export JSON/CSV
- Job queue with priorities
- Dependency graph support

**Job Orchestration:**
- Hourly incremental runs (default)
- Backfill windows (max 30 days)
- Checkpoint-based resumption
- Retry logic: 5 attempts with exponential backoff
- Status tracking: queued, running, completed, failed

**ETL Transformations:**
- Field mapping and parsing
- Unit normalization (miles → kilometers)
- Currency normalization (→ USD)
- Entity alignment across sources
- Deduplication (deterministic keys + similarity thresholds)

**Data Quality:**
- Versioned datasets with lineage tracking
- Quality metrics monitoring:
  - Missing field rate
  - Out-of-range values
  - Duplicate rate
- Anomaly alerts (>2% variance from 14-run baseline)

### 6. Messaging Center

**Message Types:**
- Appointment confirmations
- Report announcements
- System notices
- Follow-up reminders

**Delivery Channels:**
- In-app messaging (fully functional offline)
- SMS/Email outbox (manual delivery for offline mode)

**Features:**
- Message composition with recipient selection
- Inbox view for received messages
- Outbox export for manual delivery
- Message queuing and status tracking

### 7. Inspector Dashboard

**Inspection Workflow:**
- Test result entry
- Result publication
- Status updates
- Report generation

### 8. Customer Portal

**Customer Features:**
- Vehicle search
- View own inspection reports
- Appointment history
- Account management

### 9. File Management

**Upload Controls:**
- 50MB maximum file size
- MIME/extension allowlist
- SHA-256 hash blocklist
- Sensitive content detection (regex/dictionary rules)
- Quarantine for flagged content

**Download Security:**
- Bearer token authorization
- Scope-based access enforcement
- Hotlink protection (Referer validation)
- Audit logging

### 10. Compliance & Data Governance

**Data Retention:**
- Inspection reports: 7-year retention
- Tombstoned references after deletion
- Audit logs: 2-year retention with export

**Account Closure:**
- 30-day completion window
- Data anonymization
- Compliance log preservation

**Privacy Controls:**
- Field-level masking for non-privileged roles
- PII redaction in logs
- Encrypted sensitive columns (AES-256)

## Database Schema

### Core Tables

**Users & Access:**
- `users`: User accounts with roles
- `sessions`: Active sessions
- `audit_events`: Immutable audit trail

**Facilities & Resources:**
- `locations`: Physical locations
- `departments`: Organizational units
- `inspection_bays`: Bay inventory
- `equipment`: Equipment tracking
- `waiting_room_seats`: Seat configurations

**Operations:**
- `appointments`: Scheduled inspections
- `inspections`: Test results
- `vehicles`: Vehicle catalog
- `customers`: Customer records

**Data Pipeline:**
- `ingestion_jobs`: ETL job queue
- `ingestion_checkpoints`: Incremental state
- `dataset_versions`: Lineage tracking
- `quality_alerts`: Data quality issues

**Messaging:**
- `messages`: In-app messages
- `message_outbox`: Manual delivery queue

**Files & Compliance:**
- `files`: File metadata
- `file_quarantine`: Flagged files
- `retention_requests`: Account closure tracking

## Security Architecture

### Transport Security
- TLS 1.2+ with local certificates
- HTTPS-only API endpoints
- Secure WebSocket connections (if needed)

### Data Security
- AES-256 encryption at rest for sensitive columns
- Salted password hashing (bcrypt/argon2)
- JWT token signing with secret rotation
- SQL injection prevention (parameterized queries)

### Input Validation
- XSS prevention (output encoding)
- CSRF token validation
- Request size limits
- Content-Type validation

### Access Control
- Role-based permissions (RBAC)
- Scope-based data isolation (location/department)
- API endpoint authorization
- Frontend route guards

## Deployment

### Docker Compose Setup
- Backend service (Koa API)
- Frontend service (Nginx + Vue SPA)
- MySQL database
- Volume mounts for persistence

### Environment Configuration
- `.env` files for secrets
- TLS certificate paths
- Database credentials
- Rate limit thresholds

## Monitoring & Operations

### Health Checks
- API endpoint availability
- Database connectivity
- Ingestion job status
- Resource utilization

### Logging
- Structured application logs
- Audit event tracking
- Error reporting
- Performance metrics

### Backup & Recovery
- Database backups
- File storage backups
- Configuration backups
- Disaster recovery procedures

## Scalability Considerations

### Current Design
- Single-node deployment for offline operation
- Local network only
- No external dependencies

### Future Enhancements
- Multi-location synchronization
- Read replicas for reporting
- Job queue distribution
- Caching layer (Redis)

## Testing Strategy

### Unit Tests
- Backend service logic
- Data transformation functions
- Validation rules

### Integration Tests
- API endpoint testing
- Authentication flows
- RBAC enforcement
- Cross-scope isolation

### UI Tests
- Component rendering
- User interaction flows
- Role-based view access
- Form validation

## Compliance & Standards

### Data Protection
- GDPR-style right to erasure
- Data minimization
- Purpose limitation
- Retention policies

### Audit Requirements
- Immutable audit logs
- Privilege escalation detection
- Access tracking
- Change history

### Security Standards
- Input validation
- Output encoding
- Secure session management
- Password complexity requirements
