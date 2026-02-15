# PHASE 2 — USER DASHBOARD CORE (Complete)

## What was built

✅ Plans system (admin create/edit/list)  
✅ Servers/subscription system (purchase, renew, expiration)  
✅ Customer dashboard API  
✅ Admin dashboard API (monitoring)  
✅ Server expiration tracking (utility functions)  
✅ Payment records (for manual approval workflow)  

## New Database Tables

- `plans` — Hosting plans with specs (CPU, RAM, storage, player limit)
- `servers` — Customer server instances with subscription tracking
- `payments` — Payment records for approval workflow (UPI)

## File Structure (New)

```
backend/
  src/
    routes/
      auth.js                    # Signup/login (Phase 1)
      plans.js                   # List/create/update plans
      servers.js                 # Purchase, renew, list servers
      dashboard.js               # Customer & admin dashboards
    utils/
      serverExpiration.js        # Expiration logic & cron helpers
  db/
    schema.sql                   # Updated with plans, servers, payments
```

## New API Endpoints

### Plans (Public & Admin)

**Public:**
- `GET /api/plans` — List all active plans
- `GET /api/plans/:id` — Get plan details

**Admin Only:**
- `POST /api/plans` — Create new plan
- `PUT /api/plans/:id` — Update plan
- `DELETE /api/plans/:id` — Soft delete plan (set is_active=false)

### Servers (Customer & Admin)

**Customer:**
- `GET /api/servers` — List user's servers
- `GET /api/servers/:id` — Get server details (with credentials)
- `POST /api/servers` — Purchase new server (creates pending + payment)
- `POST /api/servers/:id/renew` — Renew server subscription (extends expiration)

**Admin:**
- `GET /api/servers/admin/all` — List all servers (for monitoring)

### Dashboard

**Customer:**
- `GET /api/dashboard` — Overview (stats, active servers, pending payments)

**Admin:**
- `GET /api/dashboard/admin` — Platform overview (revenue, expiring servers, pending approvals)

## Test Checklist (Run after setup)

### 1. Database Schema Update
```bash
# Backup old database (optional)
pg_dump -U postgres astra > astra_backup.sql

# Drop old schema and reload new one
psql -U postgres -d astra -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql -U postgres -d astra -f backend/db/schema.sql

# Verify tables
psql -U postgres -d astra -c "\dt"
# Should show: users, plans, servers, payments, audit_logs
```

### 2. Create Sample Plans (as Admin)

First, login as admin or create admin user:
```bash
# Signup as admin (manually insert into DB or modify signup to allow admin role)
INSERT INTO users (email, username, password_hash, role) 
VALUES ('admin@test.com', 'admin', '[hash_here]', 'admin');
```

Then create plans:
```bash
# Assuming admin is logged in and has token
curl -X POST http://localhost:3000/api/plans \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Basic",
    "description": "Small server",
    "price": 9.99,
    "duration_days": 30,
    "cpu_cores": 2,
    "ram_gb": 4,
    "storage_gb": 50,
    "max_players": 20
  }'

curl -X POST http://localhost:3000/api/plans \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pro",
    "description": "Medium server",
    "price": 19.99,
    "duration_days": 30,
    "cpu_cores": 4,
    "ram_gb": 8,
    "storage_gb": 100,
    "max_players": 50
  }'
```

### 3. List Plans (Public)
```bash
curl http://localhost:3000/api/plans
# Expected: Array of 2+ plans
```

### 4. Customer: Purchase Server
```bash
# Login as customer
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"pass1234"}' > /tmp/login.json

TOKEN=$(cat /tmp/login.json | jq -r '.token')

# Purchase a server
curl -X POST http://localhost:3000/api/servers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_id": 1, "server_name": "MyGameServer"}' > /tmp/purchase.json

# Expected: 201 with server id, status="pending", payment record created
cat /tmp/purchase.json | jq .
```

### 5. Customer: View Their Servers
```bash
curl -X GET http://localhost:3000/api/servers \
  -H "Authorization: Bearer $TOKEN"
# Expected: Array with purchased server (status: pending)
```

### 6. Customer: View Server Details (with credentials)
```bash
SERVER_ID=$(cat /tmp/purchase.json | jq -r '.server.id')

curl -X GET http://localhost:3000/api/servers/$SERVER_ID \
  -H "Authorization: Bearer $TOKEN"
# Expected: Full server details including server_username, server_password (once deployed)
```

### 7. Customer Dashboard
```bash
curl -X GET http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer $TOKEN"
# Expected: stats (total_servers=1, active_servers=0, pending_payments=1), servers array, payments array
```

### 8. Admin Dashboard
```bash
curl -X GET http://localhost:3000/api/dashboard/admin \
  -H "Authorization: Bearer ADMIN_TOKEN"
# Expected: Platform-wide stats, expiring_soon list, pending_approvals
```

### 9. Renew Server
Wait for payment approval (Phase 3), then:
```bash
curl -X POST http://localhost:3000/api/servers/$SERVER_ID/renew \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
# Expected: 200 with updated expires_at (30+ days from now)
```

### 10. Expiration Check (Utility)
```bash
# In backend code or cron job, call:
const { expireServers } = require('./src/utils/serverExpiration');
await expireServers();

# Check database
psql -U postgres -d astra -c "SELECT id, server_name, subscription_status, expires_at FROM servers;"
```

### 11. Access Control Tests

**Customer cannot create plans:**
```bash
curl -X POST http://localhost:3000/api/plans \
  -H "Authorization: Bearer CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Hacker","price":1}'
# Expected: 403 Forbidden
```

**Customer cannot access other users' servers:**
```bash
# As user1, get server
curl -X GET http://localhost:3000/api/servers \
  -H "Authorization: Bearer USER1_TOKEN"
# Returns server_id = 5

# As user2, try to access user1's server
curl -X GET http://localhost:3000/api/servers/5 \
  -H "Authorization: Bearer USER2_TOKEN"
# Expected: 404 not found (hidden, not forbidden for privacy)
```

### 12. Input Validation
```bash
# Missing required fields
curl -X POST http://localhost:3000/api/servers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_id": 1}'
# Expected: 400 missing_required_fields

# Invalid plan ID
curl -X POST http://localhost:3000/api/servers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_id": 99999, "server_name": "Test"}'
# Expected: 404 plan_not_found
```

## Security Checklist

- [ ] Plans only created/edited by admin (requireRole enforced)
- [ ] Server credentials (username/password) only viewable by owner + admin
- [ ] Payment records tied to user_id (cannot modify other users' payments)
- [ ] Server expiration updates are transactional (BEGIN/COMMIT/ROLLBACK)
- [ ] SQL injection prevented (all parameterized queries)
- [ ] No raw prices/payment amounts exposed until payment approved
- [ ] Server deletion is soft (is_deleted flag), not hard delete
- [ ] 30-day subscription logic enforced (duration_days in plans)
- [ ] Renewal extends from current expiration (no double-dipping)
- [ ] Rate limiting still active (100 req/15min)
- [ ] Error messages don't leak user/payment info
- [ ] Only active plans visible to customers
- [ ] Expired servers cannot be accessed by customers (subscription_status check)

## Common Bugs to Watch

1. **Server purchase doesn't create payment record:**
   - Ensure transaction commits properly in POST /api/servers
   - Check error logs for rollback messages

2. **Expiration dates wrong:**
   - Verify plan.duration_days is set correctly
   - Check timezone handling (use CURRENT_TIMESTAMP in PostgreSQL)

3. **Can't renew after expiration:**
   - Fix: Allow renewal even if expired (status check should be flexible)
   - Or: Add a `renewal_grace_period` config

4. **Other users can see my server:**
   - Bug: Missing `AND s.user_id = $1` in query
   - Fix: Always check user_id before returning server

5. **Payment not appearing in dashboard:**
   - Check payments table has correct foreign keys
   - Verify JOIN logic on dashboard query

6. **Can't create plans as admin:**
   - Ensure user is logged in with `role='admin'`
   - Check JWT token contains `role` in payload

## Deployment Notes

- **Cron Job for Expiration:** Set up daily job to call `expireServers()`:
  ```bash
  # In crontab:
  0 2 * * * curl -s http://localhost:3000/api/cron/expire-servers -H "X-Cron-Secret: YOUR_SECRET"
  ```
  Or run manually every day.

- **Backup before schema changes:** Always backup production DB.

- **Monitor expiring servers:** Use `/api/dashboard/admin` to track servers expiring in 7 days.

- **Payment approval notifications:** (Phase 3) Add Discord webhook to notify admins of pending payments.

## Next Phase: PHASE 3 (Awaiting confirmation)

PHASE 3 will add:
- Payment approval endpoints (admin)
- Server deployment via Pterodactyl API
- Credentials auto-generation
- Payment status notifications
- Plan editor UI for admin

**STOP HERE and wait for confirmation that Phase 2 tests pass.**
