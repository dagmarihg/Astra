const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const bodyParser = require('express').json;
const morgan = require('morgan');
const config = require('./config');
const authMiddleware = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const plansRoutes = require('./routes/plans');
const serversRoutes = require('./routes/servers');
const dashboardRoutes = require('./routes/dashboard');
const paymentsRoutes = require('./routes/payments');
const adminUsersRoutes = require('./routes/adminUsers');
const devRoutes = require('./routes/dev');
const { startAutoRenewalCron, startExpirationCleanupCron } = require('./utils/expiration');

const http = require('http');
const { Server } = require('socket.io');
const notifications = require('./utils/notifications');

const app = express();

// Request logging (avoid logging auth headers)
app.use(morgan('combined', {
  skip: (req) => req.path === '/health'
}));

// Security middlewares
if (config.isProd) {
  app.use(helmet());
  app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  }));
  app.use(helmet.hsts({ maxAge: 63072000, includeSubDomains: true }));
} else {
  app.use(helmet());
}

app.use(cors({ origin: config.cors.origin }));
app.use(bodyParser());

// Global rate limiting for all routes (conservative)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Per-route stricter limiters
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: 'Too many auth attempts, slow down.' });
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Admin rate limit exceeded.' });

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (public) with stricter rate limit
app.use('/api/auth', authLimiter, authRoutes);

// Plans routes (public listing, admin create/edit)
app.use('/api/plans', plansRoutes);

// Servers routes (customer & admin)
app.use('/api/servers', serversRoutes);

// Dashboard routes
app.use('/api/dashboard', dashboardRoutes);

// Payments routes (admin only) - protect with admin limiter
// Payments routes (admin endpoints are protected inside the router)
// Mount at /api/payments so both customer (upload) and admin endpoints are available.
app.use('/api/payments', adminLimiter, paymentsRoutes);
// Keep legacy admin mount for tests and external callers
app.use('/api/admin/payments', adminLimiter, paymentsRoutes);
// Admin users management
app.use('/api/admin/users', adminLimiter, adminUsersRoutes);

// Development-only routes (emit helper for realtime testing)
if (!config.isProd) {
  app.use('/api/dev', devRoutes);
}

// Protected route example (requires valid JWT)
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({
    message: 'user_info',
    user: req.user,
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

// Start
const port = config.port;
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.cors.origin }
});

// Basic namespace: on connection, verify admin JWT and allow admins to join 'admins' room
const { verifyToken } = require('./utils/jwt');
io.on('connection', (socket) => {
  socket.on('join_admin', (data) => {
    try {
      const token = data && data.token ? data.token : null;
      if (!token) return socket.emit('error', { error: 'missing_token' });
      const payload = verifyToken(token);
      if (!payload || payload.role !== 'admin') {
        return socket.emit('error', { error: 'invalid_token' });
      }
      socket.join('admins');
      socket.emit('joined', { room: 'admins' });
    } catch (err) {
      console.error('[SOCKET_JOIN_ERROR]', err.message);
      socket.emit('error', { error: 'internal_error' });
    }
  });
});

// Expose io to other modules
notifications.setIO(io);

server.listen(port, () => {
  console.log(`Astra backend listening on ${port}`);

  // Start background jobs
  startAutoRenewalCron();
  startExpirationCleanupCron();
});
