# RoadSafe Backend (Koa)

## Environment
Copy `.env.example` to `.env` if running outside Docker.

## API Endpoints
- `GET /health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/register` (Administrator only)
- `GET /api/dashboard/summary` (scope-aware)
- `GET /api/dashboard/coordinator-view`
- `GET /api/security/config` (Administrator, Data Engineer)
- `GET /api/search/vehicles`
- `GET /api/search/autocomplete`
- `GET /api/search/trending`
- `POST /api/messages/send`
- `GET /api/messages/inbox`
- `POST /api/messages/outbox/export`
- `POST /api/files/ingest`
- `POST /api/compliance/account-closure`
- `POST /api/compliance/retention/run`

## Security Baseline
- PBKDF2 salted password hashing (`sha512`, 120000 iterations)
- Password policy: min 12 characters + uppercase + lowercase + number + special
- Stateless bearer session token persisted in MySQL with revocation support
- RBAC with location/department scoping middleware
- Rate limiting middleware (per IP + per user)
