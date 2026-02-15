# PHASE 3 — PAYMENT APPROVAL & SERVER DEPLOYMENT

## Overview

PHASE 3 implements:
1. **Admin Payment Approval** - Approve/reject pending payments
2. **Frontend Dashboard** - Customer & admin UI for purchasing and managing
3. **Pterodactyl Integration** - Auto-deploy servers on payment approval
4. **Auto-Expiration** - Cron job to auto-renew or mark servers expired
5. **Credentials Management** - Auto-generate server login credentials

## Architecture

```
Admin Payment Flow:
┌─────────────────┐
│  Customer Pays  │ (via UPI transfer)
│  Creates Order  │
└────────┬────────┘
         │ Payment created (status: pending, utr: null)
         │
┌────────▼────────────────┐
│ Admin Reviews Payment   │
│ (GET /api/admin/payments) - Lists pending
└────────┬────────────────┘
         │
┌────────▼────────────────────────┐
│ Admin Approves (POST /..../approve)
│ - Verify UTR against bank/receipt
│ - Create server on Pterodactyl
│ - Generate credentials
│ - Mark payment approved
└────────┬────────────────────────┘
         │
┌────────▼──────────────────────────┐
│ Server Deployment Complete
│ - Server status: active
│ - Send credentials to customer
│ - Charge subscription fee
└───────────────────────────────────┘
```

## Database Updates

No schema changes needed. Use existing:
- `payments` table (add `utr` field on admin approval)
- `servers` table (update status on deployment)

## New API Endpoints

### Payment Management (Admin Only)

```
GET /api/admin/payments
  - List all pending payments
  - Response: [{ id, amount, username, email, server_id, ...}]

GET /api/admin/payments/:id
  - Get payment details with bank verification fields
  
POST /api/admin/payments/:id/approve
  - Approve a payment
  - Body: { utr: "UTR123456", pterodactyl_node: "node-1" }
  - Action:
    * Create server on Pterodactyl
    * Generate SFTP credentials
    * Store credentials in database
    * Update payment status: approved
    * Update server status: active
    * Log to audit_logs
  - Response: { message: "payment_approved", server: {...} }

POST /api/admin/payments/:id/reject
  - Reject a payment
  - Body: { reason: "Invalid UTR" }
  - Action:
    * Update payment status: rejected
    * Delete associated server
    * Log to audit_logs
  - Response: { message: "payment_rejected" }

GET /api/admin/payments/audit/logs
  - View all payment approvals/rejections
  - For compliance & audit trail
```

### Server Credentials (Protected)

```
GET /api/servers/:id/credentials
  - Get SFTP login for server
  - Response: { host, username, password, port }
  - Only accessible after server is active
```

## Files to Create/Update

### Backend
- `backend/src/routes/payments.js` (NEW) - Payment approval endpoints
- `backend/src/routes/servers.js` - Update to include credentials endpoint
- `backend/src/utils/pterodactyl.js` (NEW) - Pterodactyl API client
- `backend/src/utils/credentials.js` (NEW) - Password generation
- `backend/src/utils/expiration.js` - Cron for auto-renewal/cleanup
- `backend/src/index.js` - Add cron job startup

### Frontend
- `frontend/public/admin.html` (NEW) - Admin payment approval dashboard
- `frontend/public/dashboard.html` (NEW) - Customer server dashboard
- `frontend/public/styles/admin.css` (NEW) - Admin styles
- `frontend/public/purchase.html` (NEW) - Server purchase flow
- `frontend/public/app.js` (NEW) - Client-side logic

### Testing
- `test-phase3.sh` (NEW) - Payment approval test suite

## Implementation Order

### Step 1: Payment Approval Endpoints
- Create `/api/admin/payments` endpoints
- Implement payment approval/rejection logic
- Add audit logging

### Step 2: Pterodactyl Integration
- Build Pterodactyl API wrapper (`pterodactyl.js`)
- Handle server deployment on approval
- Store credentials securely

### Step 3: Frontend Dashboard
- Build admin dashboard UI
- Build customer dashboard UI
- Payment approval workflow UI

### Step 4: Auto-Expiration & Cleanup
- Implement cron job for:
  - Auto-renew active subscriptions (1 day before expiry)
  - Mark expired servers
  - Send expiry warnings

### Step 5: Testing
- Test payment approval flow
- Test Pterodactyl integration
- Test expiration logic
- Full e2e test suite

## Configuration Requirements

Add to `.env`:
```env
# Pterodactyl API
PTERODACTYL_URL=https://panel.example.com
PTERODACTYL_API_KEY=your-api-key
PTERODACTYL_NODE_ID=1
PTERODACTYL_EGG_ID=1
PTERODACTYL_IMAGE=ghcr.io/pterodactyl/yolks:java_17

# Server defaults
DEFAULT_MEMORY=1024
DEFAULT_DISK=5000
DEFAULT_CPU=100

# Auto-renewal cron (in hours, e.g., 24 = daily)
CRON_AUTO_RENEW_INTERVAL=24
CRON_CLEANUP_INTERVAL=24
```

## Success Criteria

✅ Admin can approve pending payments  
✅ Approved payments create active servers on Pterodactyl  
✅ Customers receive SFTP credentials after approval  
✅ Servers auto-renew 1 day before expiry  
✅ Expired servers are marked and deleted  
✅ Full admin dashboard functional  
✅ Full customer dashboard functional  
✅ All 20 tests pass  

## Testing Checklist

```
Payment Approval (5 tests)
- [ ] List pending payments
- [ ] Approve payment → Server created on Pterodactyl
- [ ] Reject payment → Payment marked rejected, server deleted
- [ ] Get credentials for active server
- [ ] Customer dashboard shows active server with credentials

Auto-Expiration (3 tests)
- [ ] Server auto-renews 1 day before expiry
- [ ] Expired server marked as expired
- [ ] Payment created for renewal

Pterodactyl Integration (5 tests)
- [ ] Create server container on Pterodactyl
- [ ] Get server details from Pterodactyl
- [ ] Generate valid SFTP credentials
- [ ] Server assigned unique subdomain
- [ ] Resource limits applied (CPU, RAM, disk)

Dashboard UI (7 tests)
- [ ] Admin sees pending payments list
- [ ] Admin can approve/reject payments
- [ ] Customer sees active servers
- [ ] Customer can purchase new servers
- [ ] Customer can renew servers
- [ ] Customer dashboard shows renewal dates
- [ ] Customer can view server credentials
```

## Pterodactyl JSON Payload Example

```json
{
  "name": "Test Server 1",
  "user_id": 1,
  "egg_id": 1,
  "docker_image": "ghcr.io/pterodactyl/yolks:java_17",
  "startup": "java -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui",
  "limits": {
    "memory": 1024,
    "swap": 0,
    "disk": 5000,
    "io": 500,
    "cpu": 100
  },
  "feature_limits": {
    "databases": 1,
    "backups": 3,
    "allocations": 1
  },
  "allocation": {
    "default": 1
  }
}
```

## Notes

- Pterodactyl integration optional if API not available (mock responses)
- Credentials generated using `crypto` module (no external service)
- Auto-renewal uses `node-schedule` package
- Audit logging tracks all admin actions for compliance
- Payment approval requires manual UTR verification (no auto-bank integration)
