const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const bodyParser = require('express').json;
const config = require('./config');
const authMiddleware = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const plansRoutes = require('./routes/plans');
const serversRoutes = require('./routes/servers');
const dashboardRoutes = require('./routes/dashboard');
const paymentsRoutes = require('./routes/payments');
const { startAutoRenewalCron, startExpirationCleanupCron } = require('./utils/expiration');

const app = express();

// Security middlewares
app.use(helmet());
app.use(cors({ origin: config.cors.origin }));
app.use(bodyParser());

// Rate limiting for all routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Plans routes (public listing, admin create/edit)
app.use('/api/plans', plansRoutes);

// Servers routes (customer & admin)
app.use('/api/servers', serversRoutes);

// Dashboard routes
app.use('/api/dashboard', dashboardRoutes);

// Payments routes (admin only)
app.use('/api/admin/payments', paymentsRoutes);

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
app.listen(port, () => {
  console.log(`Astra backend listening on ${port}`);

  // Start background jobs
  startAutoRenewalCron();
  startExpirationCleanupCron();
});
