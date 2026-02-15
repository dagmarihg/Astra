const express = require('express');
const pool = require('../../db/connection');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

// Customer dashboard overview
router.get('/', authMiddleware, requireRole('customer'), async (req, res) => {
  const { id: userId } = req.user;

  try {
    // Get user subscription stats
    const stats = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM servers WHERE user_id = $1 AND is_deleted = false) AS total_servers,
        (SELECT COUNT(*) FROM servers WHERE user_id = $1 AND subscription_status = 'active' AND is_deleted = false) AS active_servers,
        (SELECT COUNT(*) FROM servers WHERE user_id = $1 AND subscription_status = 'expired' AND is_deleted = false) AS expired_servers,
        (SELECT COUNT(*) FROM payments WHERE user_id = $1 AND status = 'pending') AS pending_payments`,
      [userId]
    );

    // Get active servers with expiration countdown
    const servers = await pool.query(
      `SELECT s.id, s.server_name, s.status, s.subscription_status, s.expires_at,
              EXTRACT(DAY FROM s.expires_at - CURRENT_TIMESTAMP) AS days_remaining,
              p.name AS plan_name, p.price
       FROM servers s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = $1 AND s.is_deleted = false AND s.subscription_status = 'active'
       ORDER BY s.expires_at ASC
       LIMIT 5`,
      [userId]
    );

    // Get pending payments
    const payments = await pool.query(
      `SELECT p.id, p.amount, p.status, p.created_at,
              pl.name AS plan_name, s.server_name
       FROM payments p
       JOIN plans pl ON p.plan_id = pl.id
       LEFT JOIN servers s ON p.server_id = s.id
       WHERE p.user_id = $1 AND p.status IN ('pending', 'rejected')
       ORDER BY p.created_at DESC
       LIMIT 10`,
      [userId]
    );

    res.json({
      stats: stats.rows[0],
      active_servers: servers.rows,
      pending_payments: payments.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Admin dashboard overview
router.get('/admin', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    // Platform statistics
    const stats = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'customer') AS total_customers,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') AS total_admins,
        (SELECT COUNT(*) FROM servers WHERE is_deleted = false) AS total_servers,
        (SELECT COUNT(*) FROM servers WHERE subscription_status = 'active') AS active_servers,
        (SELECT COUNT(*) FROM servers WHERE subscription_status = 'expired') AS expired_servers,
        (SELECT COUNT(*) FROM payments WHERE status = 'pending') AS pending_payments,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'approved') AS total_revenue`
    );

    // Servers expiring soon (next 7 days)
    const expiringServers = await pool.query(
      `SELECT s.id, s.server_name, u.username, s.expires_at,
              EXTRACT(DAY FROM s.expires_at - CURRENT_TIMESTAMP) AS days_remaining,
              p.name AS plan_name
       FROM servers s
       JOIN users u ON s.user_id = u.id
       JOIN plans p ON s.plan_id = p.id
       WHERE s.expires_at < CURRENT_TIMESTAMP + INTERVAL '7 days'
       AND s.subscription_status = 'active'
       AND s.is_deleted = false
       ORDER BY s.expires_at ASC
       LIMIT 20`
    );

    // Pending payment approvals
    const pendingPayments = await pool.query(
      `SELECT p.id, p.amount, u.username, u.email, p.utr, p.created_at,
              pl.name AS plan_name, s.server_name
       FROM payments p
       JOIN users u ON p.user_id = u.id
       JOIN plans pl ON p.plan_id = pl.id
       LEFT JOIN servers s ON p.server_id = s.id
       WHERE p.status = 'pending'
       ORDER BY p.created_at ASC`
    );

    res.json({
      stats: stats.rows[0],
      expiring_soon: expiringServers.rows,
      pending_approvals: pendingPayments.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
