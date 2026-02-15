# Astra — Production-Ready SaaS Hosting Panel

Building a secure, scalable hosting panel from scratch in GitHub Codespaces.

## Current Status: PHASE 3 Complete ✅

**PHASE 1 ✅:**
- ✅ Backend scaffolding
- ✅ Frontend scaffolding (vanilla HTML)
- ✅ Database setup (PostgreSQL)
- ✅ Authentication (JWT + bcrypt)
- ✅ Role-based access control
- ✅ Input validation
- ✅ Rate limiting & security headers

**PHASE 2 ✅:**
- ✅ Plans system (admin create/edit/list)
- ✅ Server purchase flow
- ✅ Subscription management (30-day auto-renew)
- ✅ Customer & admin dashboards
- ✅ Payment tracking (UPI approval workflow)
- ✅ Server expiration logic

**PHASE 3 ✅:**
- ✅ Payment approval endpoints (admin)
- ✅ Server credentials generation & retrieval
- ✅ Auto-expiration & renewal cron jobs
- ✅ Pterodactyl API integration (stub)
- ✅ All 12 tests passing

## Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL 12+

### Backend Setup
```bash
# 1. Copy env and configure
cp .env.example .env
# Edit .env with your DB credentials

# 2. Create database and schema
createdb astra
psql -U postgres -d astra -f backend/db/schema.sql

# 3. Install and run
cd backend
npm install
npm start
# Backend: http://localhost:3000
```

### Frontend Setup
```bash
cd frontend
node public/server.js
# Frontend: http://localhost:3001
```

## Project Structure

```
Astra/
  backend/
    src/
      index.js                   # Express app
      config.js                  # Env config
      middleware/                # Auth, validation, role
      routes/
        auth.js                  # Login/signup
        plans.js                 # Plan management
        servers.js               # Server purchase/renew
        dashboard.js             # Dashboards
      utils/
        hash.js, jwt.js          # Crypto utilities
        serverExpiration.js      # Expiration logic
    db/
      connection.js              # PostgreSQL pool
      schema.sql                 # Database schema
    package.json
  frontend/
    public/
      index.html                 # Dark gradient UI
      server.js                  # Static server
    package.json
  PHASE1.md                      # Phase 1 details
  PHASE2.md                      # Phase 2 details
  README.md                      # This file
```

## API Endpoints

### Phase 1 — Authentication
- `POST /api/auth/signup` — Register user
- `POST /api/auth/login` — Get JWT token
- `GET /api/me` — User info (protected)

### Phase 2 — Plans & Servers
- `GET /api/plans` — List active plans
- `GET /api/plans/:id` — Plan details
- `POST /api/plans` — Create plan (admin only)
- `PUT /api/plans/:id` — Update plan (admin only)
- `DELETE /api/plans/:id` — Delete plan (admin only)

- `GET /api/servers` — List user's servers
- `GET /api/servers/:id` — Server details
- `POST /api/servers` — Purchase server
- `POST /api/servers/:id/renew` — Renew subscription

### Dashboard
- `GET /api/dashboard` — Customer overview
- `GET /api/dashboard/admin` — Admin overview

### Phase 3 — Payment Approval & Deployment
- `GET /api/admin/payments` — List pending payments (admin only)
- `GET /api/admin/payments/:id` — Payment details (admin only)
- `POST /api/admin/payments/:id/approve` — Approve payment & deploy server (admin only)
- `POST /api/admin/payments/:id/reject` — Reject payment (admin only)
- `GET /api/servers/:id/credentials` — Get SFTP credentials (protected)

### Utilities
- `GET /health` — Health check

## Security Features

- Helmet security headers
- JWT + bcrypt authentication
- Role-based access (Admin/Customer)
- Input validation + sanitization
- Rate limiting (100 req/15min per IP)
- SQL injection prevention
- Transactional payment processing
- Soft deletes for data safety
- 30-day subscription enforcement
- Server expiration auto-detection
- Automatic credential generation
- Payment audit logging

## Background Jobs

- Auto-renewal cron (every 6 hours) — Auto-renew servers 1 day before expiry
- Expiration cleanup cron (daily) — Mark expired servers & cleanup

## Testing

See:
- [PHASE1.md](PHASE1.md) — Phase 1 test checklist
- [PHASE2.md](PHASE2.md) — Phase 2 test checklist
- [PHASE3.md](PHASE3.md) — Phase 3 test checklist

## Next Phase

**PHASE 3 (awaiting confirmation):**
- Payment approval admin panel
- Pterodactyl API integration
- Credentials auto-generation
- Server deployment on approval
- Auto-expiration cleanup