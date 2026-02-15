const express = require('express');
const pool = require('../../db/connection');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { generateSFTPCredentials } = require('../utils/credentials');

const router = express.Router();

// Admin: List all pending payments
router.get(
  '/',
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT p.id, p.amount, p.status, p.utr, p.created_at,
                u.username, u.email,
                s.id AS server_id, s.server_name,
                pl.name AS plan_name, pl.price
         FROM payments p
         JOIN users u ON p.user_id = u.id
         JOIN servers s ON p.server_id = s.id
         JOIN plans pl ON p.plan_id = pl.id
         WHERE p.status = 'pending'
         ORDER BY p.created_at ASC`
      );

      res.json({ payments: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

// Admin: Get payment details
router.get(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(
        `SELECT p.id, p.amount, p.status, p.utr, p.created_at, p.rejection_reason,
                u.id AS user_id, u.username, u.email,
                s.id AS server_id, s.server_name,
                pl.name AS plan_name, pl.price
         FROM payments p
         JOIN users u ON p.user_id = u.id
         JOIN servers s ON p.server_id = s.id
         JOIN plans pl ON p.plan_id = pl.id
         WHERE p.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'payment_not_found' });
      }

      res.json({ payment: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

// Admin: Approve payment
router.post(
  '/:id/approve',
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const { id } = req.params;
    const { utr, pterodactyl_node_id } = req.body;
    const adminId = req.user.id;

    if (!utr) {
      return res.status(400).json({ error: 'missing_utr' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get payment with server info
      const paymentResult = await client.query(
        `SELECT p.id, p.user_id, p.server_id, p.amount, p.status,
                s.id AS server_id, s.server_name
         FROM payments p
         JOIN servers s ON p.server_id = s.id
         WHERE p.id = $1 AND p.status = 'pending'`,
        [id]
      );

      if (paymentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'payment_not_found' });
      }

      const payment = paymentResult.rows[0];

      // Generate SFTP credentials
      const credentials = generateSFTPCredentials(payment.server_id);

      // Update payment: mark as approved, add UTR
      await client.query(
        `UPDATE payments SET
         status = 'approved',
         utr = $1,
         approved_by = $2,
         approved_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [utr, adminId, id]
      );

      // Update server: mark as active, store credentials
      await client.query(
        `UPDATE servers SET
         status = 'active',
         server_username = $1,
         server_password = $2,
         pterodactyl_id = $3
         WHERE id = $4`,
        [credentials.username, credentials.password, pterodactyl_node_id || 'manual', payment.server_id]
      );

      // Log to audit
      await client.query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [adminId, 'payment_approved', 'payment', id, 'success']
      );

      await client.query('COMMIT');

      res.json({
        message: 'payment_approved',
        payment: {
          id: payment.id,
          status: 'approved',
          utr,
        },
        server: {
          id: payment.server_id,
          status: 'active',
          credentials,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[APPROVE_ERROR]', err);
      res.status(500).json({ error: 'internal_error' });
    } finally {
      client.release();
    }
  }
);

// Admin: Reject payment
router.post(
  '/:id/reject',
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    if (!reason) {
      return res.status(400).json({ error: 'missing_reason' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get payment
      const paymentResult = await client.query(
        `SELECT p.id, p.server_id, p.status
         FROM payments p
         WHERE p.id = $1 AND p.status = 'pending'`,
        [id]
      );

      if (paymentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'payment_not_found' });
      }

      const payment = paymentResult.rows[0];

      // Update payment: mark as rejected
      await client.query(
        `UPDATE payments SET
         status = 'rejected',
         rejection_reason = $1
         WHERE id = $2`,
        [reason, id]
      );

      // Soft delete server (is_deleted = true)
      await client.query(
        `UPDATE servers SET is_deleted = true WHERE id = $1`,
        [payment.server_id]
      );

      // Log to audit
      await client.query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [adminId, 'payment_rejected', 'payment', id, 'success']
      );

      await client.query('COMMIT');

      res.json({
        message: 'payment_rejected',
        payment: {
          id: payment.id,
          status: 'rejected',
          reason,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[REJECT_ERROR]', err);
      res.status(500).json({ error: 'internal_error' });
    } finally {
      client.release();
    }
  }
);

module.exports = router;

