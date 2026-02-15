# PHASE 1 — PROJECT SETUP & SECURITY BASE (Complete)

## What was built

✅ Environment configuration (`.env.example`)  
✅ Database connection (PostgreSQL with `pg` package)  
✅ Auth system (JWT + bcrypt)  
✅ Role-based access control middleware  
✅ Input validation (express-validator)  
✅ Rate limiting (express-rate-limit)  
✅ Security headers (helmet)  
✅ User schema (users table with roles)  

## File Structure

```
backend/
  src/
    config.js                    # Load env vars
    index.js                     # Express app + routes
    utils/
      hash.js                    # bcrypt helpers
      jwt.js                     # JWT token generation/verification
    middleware/
      auth.js                    # JWT verification
      role.js                    # Role-based access control
      validation.js              # Input validation
    routes/
      auth.js                    # Signup/login endpoints
  db/
    connection.js                # PostgreSQL pool
    schema.sql                   # User table schema
  package.json                   # Dependencies
  README.md                      # Setup instructions
.env.example                     # Environment template
```

## Test Checklist (Run after setup)

1. **Database connection:**
   ```bash
   # Ensure PostgreSQL is running
   psql -U postgres -d astra -c "SELECT 1"
   ```

2. **Backend startup:**
   ```bash
   cd backend && npm install && npm start
   # Should log: "Astra backend listening on 3000"
   ```

3. **Health endpoint:**
   ```bash
   curl http://localhost:3000/health
   # Expected: {"status":"ok","timestamp":"..."}
   ```

4. **Signup (valid input):**
   ```bash
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"user1@test.com","username":"user1","password":"pass1234"}'
   # Expected: 201 with token
   ```

5. **Signup (invalid email):**
   ```bash
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"invalid","username":"user2","password":"pass1234"}'
   # Expected: 400 validation_error
   ```

6. **Signup (weak password):**
   ```bash
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"user3@test.com","username":"user3","password":"short"}'
   # Expected: 400 validation_error (min 8 chars)
   ```

7. **Duplicate email:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"user1@test.com","username":"user4","password":"pass1234"}'
   # Expected: 409 user_exists
   ```

8. **Login (valid):**
   ```bash
   RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user1@test.com","password":"pass1234"}')
   TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
   # Save TOKEN for next test
   # Expected: 200 with valid JWT
   ```

9. **Login (wrong password):**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user1@test.com","password":"wrongpass"}'
   # Expected: 401 invalid_credentials
   ```

10. **Protected route (valid token):**
    ```bash
    curl -X GET http://localhost:3000/api/me \
      -H "Authorization: Bearer $TOKEN"
    # Expected: 200 with user_info
    ```

11. **Protected route (invalid token):**
    ```bash
    curl -X GET http://localhost:3000/api/me \
      -H "Authorization: Bearer invalid_token"
    # Expected: 401 invalid_token
    ```

12. **Protected route (missing token):**
    ```bash
    curl -X GET http://localhost:3000/api/me
    # Expected: 401 missing_token
    ```

13. **Rate limiting (100 requests in 15 min):**
    ```bash
    for i in {1..101}; do curl -s http://localhost:3000/health > /dev/null; done
    # 101st request should be rate limited: 429
    ```

14. **Frontend connectivity:**
    - Open http://localhost:3001
    - Click "Check Backend" button
    - Should see success message

## Security Checklist

- [ ] PostgreSQL credentials in `.env` (not in repo)
- [ ] JWT secret is random and long (min 32 chars)
- [ ] bcrypt rounds set to 12 (password hashing strength)
- [ ] CORS origin set to frontend URL only
- [ ] Helmet headers enabled (X-Frame-Options, X-Content-Type-Options, etc.)
- [ ] Rate limiting applied (100 req/15min per IP)
- [ ] Input validation on signup/login (length, format, type)
- [ ] SQL injection prevention (parameterized queries via pg)
- [ ] Passwords hashed before storage (bcrypt, never plain text)
- [ ] Password field never returned in JSON responses
- [ ] Active user check on login (is_active = true)
- [ ] Token expiry enforced (7 days default)
- [ ] Error messages generic (no user enumeration: "invalid_credentials" vs "user not found")
- [ ] Environment variables never logged
- [ ] 404 handler catches undefined routes
- [ ] Error handler prevents stack trace leaks

## Common Bugs to Watch

1. **Database connection fails:**
   - Check PostgreSQL is running: `psql -l`
   - Verify `.env` DB credentials match your setup
   - Error: "connect ECONNREFUSED 127.0.0.1:5432" → PostgreSQL not active

2. **CORS errors in frontend:**
   - Ensure `CORS_ORIGIN=http://localhost:3001` in `.env`
   - Error: "Access to XMLHttpRequest from 'http://localhost:3001' origin denied"
   - Fix: Update CORS_ORIGIN in `.env` and restart backend

3. **JWT token not working:**
   - Ensure `JWT_SECRET` is set in `.env` (and consistent across restarts)
   - Tokens expire after 7 days; regenerate with login
   - Error: "invalid_token" → token might be expired or secret changed

4. **Duplicate key error on signup:**
   - Email or username already exists in database
   - Error: "duplicate key value violates unique constraint"
   - Fix: Use a different email/username or delete old user row

5. **Password hashing slow:**
   - If bcrypt takes >5 seconds per hash, reduce BCRYPT_ROUNDS to 10
   - Default 12 is secure but slower

6. **Rate limit too strict:**
   - If legitimate users hit 429, increase `max` in index.js limiter
   - Current: 100 req/15 min per IP

## Deployment Notes (VPS)

- Use `.env` file with production values (strong JWT_SECRET, real DB creds)
- Run on port 3000 (or configure via PORT env var)
- Use systemd/PM2/Docker to keep process alive
- Set `NODE_ENV=production` in `.env` for optimizations
- Use a reverse proxy (nginx/caddy) for HTTPS termination
- Monitor logs for errors and suspicious login attempts
- Backup PostgreSQL database regularly

## Next Phase: PHASE 2 (Awaiting confirmation)

PHASE 2 will add:
- Customer dashboard routes
- Plan system (create, list, update)
- Server record management
- Subscription logic
- Auto-expiration timers

**STOP HERE and wait for confirmation that Phase 1 tests pass.**
