# Astra Backend — Phase 1 & 2

Secure backend with auth, plans, servers, and dashboard.

## Prerequisites

- Node.js 16+
- PostgreSQL 12+

## Setup

1. **Copy and configure environment:**
```bash
cp .env.example .env
# Edit .env with your database credentials and JWT secret
```

2. **Create PostgreSQL database and schema:**
```bash
# Create database
createdb astra

# Run schema (includes users, plans, servers, payments tables)
psql -U postgres -d astra -f backend/db/schema.sql
```

3. **Install dependencies:**
```bash
cd backend
npm install
```

4. **Run locally:**
```bash
npm start
# Backend listens on http://localhost:3000
```

## API Endpoints

### Phase 1 — Authentication

#### Public
- `GET /health` — Health check
- `POST /api/auth/signup` — Register new user
- `POST /api/auth/login` — Get JWT token

**Example - Signup:**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"username","password":"password123"}'
```

**Example - Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

#### Protected
- `GET /api/me` — Get authenticated user info (requires Bearer token)

**Example:**
```bash
curl -X GET http://localhost:3000/api/me \
  -H "Authorization: Bearer <your_jwt_token>"
```

### Phase 2 — Plans

#### Public
- `GET /api/plans` — List all active plans
- `GET /api/plans/:id` — Get plan details

**Example - List Plans:**
```bash
curl http://localhost:3000/api/plans
```

#### Admin Only
- `POST /api/plans` — Create new plan
- `PUT /api/plans/:id` — Update plan
- `DELETE /api/plans/:id` — Soft delete plan

**Example - Create Plan (admin):**
```bash
curl -X POST http://localhost:3000/api/plans \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Basic",
    "description": "2 CPU, 4GB RAM",
    "price": 9.99,
    "cpu_cores": 2,
    "ram_gb": 4,
    "storage_gb": 50,
    "max_players": 20
  }'
```

### Phase 2 — Servers

#### Customer
- `GET /api/servers` — List user's servers
- `GET /api/servers/:id` — Get server details (with credentials)
- `POST /api/servers` — Purchase new server
- `POST /api/servers/:id/renew` — Renew server subscription

**Example - Purchase Server:**
```bash
CUSTOMER_TOKEN="<jwt_token>"
curl -X POST http://localhost:3000/api/servers \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_id": 1, "server_name": "MyGameServer"}'
# Returns: server (status=pending), payment record
```

**Example - Renew Server:**
```bash
SERVER_ID=1
curl -X POST http://localhost:3000/api/servers/$SERVER_ID/renew \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json"
# Returns: updated server with new expiration date
```

#### Admin
- `GET /api/servers/admin/all` — List all servers (for monitoring)

### Phase 2 — Dashboard

#### Customer
- `GET /api/dashboard` — Overview (stats, active servers, pending payments)

**Example:**
```bash
curl http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer <customer_token>"
# Returns: total_servers, active_servers, payments, expiring servers
```

#### Admin
- `GET /api/dashboard/admin` — Platform overview (revenue, expiring servers, pending approvals)

**Example:**
```bash
curl http://localhost:3000/api/dashboard/admin \
  -H "Authorization: Bearer <admin_token>"
# Returns: total_customers, total_revenue, expiring_soon, pending_approvals
```

## Database Schema

### Tables
- `users` — User accounts (customer/admin roles)
- `plans` — Hosting plans with specs (CPU, RAM, storage, player limit, price)
- `servers` — Customer server instances with subscription tracking
- `payments` — Payment records for manual approval workflow (UPI)
- `audit_logs` — Audit trail for security

### Key Relationships
- `servers.user_id` → `users.id`
- `servers.plan_id` → `plans.id`
- `payments.user_id` → `users.id`
- `payments.server_id` → `servers.id`

## Environment Variables

```env
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=astra
DB_USER=postgres
DB_PASSWORD=your_db_password

# JWT
JWT_SECRET=your_long_random_secret
JWT_EXPIRY=7d

# Password hashing
BCRYPT_ROUNDS=12

# CORS
CORS_ORIGIN=http://localhost:3001
```

## Security

- Passwords hashed with bcrypt (rounds: 12)
- JWT tokens with 7-day expiry (configurable)
- Rate limiting: 100 requests per 15 minutes per IP
- Helmet headers enabled
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- Role-based access control (Admin/Customer)
- Transactional payment processing
- 30-day subscription enforcement
- Soft deletes (no hard deletes)

## Testing

See [PHASE1.md](../../PHASE1.md) and [PHASE2.md](../../PHASE2.md) for detailed test checklists.

## Deployment (VPS)

1. **Install PostgreSQL** on VPS
2. **Create database:** `createdb astra`
3. **Load schema:** `psql -d astra -f db/schema.sql`
4. **Set production `.env`** (strong JWT_SECRET, real DB creds)
5. **Use PM2/systemd** to keep process alive:
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name astra
   pm2 save
   pm2 startup
   ```
6. **Use nginx/caddy** for HTTPS reverse proxy
7. **Monitor logs:** `pm2 logs astra`

## Next Phase

**PHASE 3 (pending approval):**
- Payment approval endpoints
- Pterodactyl API integration
- Auto-deployment on approval
- Discord bot notifications
- Server auto-expiration cleanup
# Astra Backend (Phase 1)

Minimal instructions to run the Phase 1 backend locally or on a VPS.

Prereqs:
- Node 18+
- PostgreSQL (self-hosted)

Quick start:

1. Copy `.env.example` to `.env` and set values.
2. Install deps:

```bash
cd backend
npm install
```

3. Initialize DB: run the SQL in `db/init.sql` against your Postgres instance.

4. Start dev server:

```bash
npm run dev
```
