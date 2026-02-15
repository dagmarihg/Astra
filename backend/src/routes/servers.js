const express = require('express');
const pool = require('../../db/connection');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

// Customer: List their servers
router.get('/', authMiddleware, async (req, res) => {
  const { id: userId } = req.user;

  try {
    const result = await pool.query(
      `SELECT s.id, s.server_name, s.status, s.ip_address, s.port, 
              s.created_at, s.expires_at, s.subscription_status,
              p.name AS plan_name, p.price, p.duration_days
       FROM servers s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = $1 AND s.is_deleted = false
       ORDER BY s.created_at DESC`,
      [userId]
    );

    res.json({ servers: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Customer: Get single server details
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;

  try {
    const result = await pool.query(
      `SELECT s.id, s.server_name, s.status, s.ip_address, s.port, 
              s.server_username, s.server_password, s.pterodactyl_id,
              s.created_at, s.expires_at, s.subscription_status,
              p.id AS plan_id, p.name AS plan_name, p.price, p.cpu_cores, p.ram_gb, p.storage_gb, p.max_players
       FROM servers s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.id = $1 AND s.user_id = $2 AND s.is_deleted = false`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'server_not_found' });
    }

    res.json({ server: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Customer: Purchase a server (creates pending server, awaits payment approval)
router.post('/', authMiddleware, requireRole('customer'), async (req, res) => {
  const { plan_id, server_name } = req.body;
  const { id: userId } = req.user;

  if (!plan_id || !server_name) {
    return res.status(400).json({ error: 'missing_required_fields' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify plan exists
    const planResult = await client.query('SELECT id, price, duration_days FROM plans WHERE id = $1 AND is_active = true', [plan_id]);
    if (planResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'plan_not_found' });
    }

    const plan = planResult.rows[0];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.duration_days);

    // Create server (status: pending, awaiting payment approval)
    const serverResult = await client.query(
      `INSERT INTO servers (user_id, plan_id, server_name, status, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, server_name, status, expires_at, created_at`,
      [userId, plan_id, server_name, 'pending', expiresAt]
    );

    const server = serverResult.rows[0];

    // Create payment record (awaiting approval)
    const paymentResult = await client.query(
      `INSERT INTO payments (user_id, server_id, plan_id, amount, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, amount, status`,
      [userId, server.id, plan_id, plan.price, 'pending']
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'server_pending_approval',
      server,
      payment: paymentResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

// Customer: Renew server (extend expiration by plan duration)
router.post('/:id/renew', authMiddleware, requireRole('customer'), async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get current server
    const serverResult = await client.query(
      `SELECT s.id, s.plan_id, s.expires_at, s.status, s.subscription_status
       FROM servers s
       WHERE s.id = $1 AND s.user_id = $2 AND s.is_deleted = false`,
      [id, userId]
    );

    if (serverResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'server_not_found' });
    }

    const server = serverResult.rows[0];

    // Get plan for duration
    const planResult = await client.query(
      'SELECT duration_days, price FROM plans WHERE id = $1 AND is_active = true',
      [server.plan_id]
    );

    if (planResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'plan_not_found' });
    }

    const plan = planResult.rows[0];
    const newExpiresAt = new Date(server.expires_at);
    newExpiresAt.setDate(newExpiresAt.getDate() + plan.duration_days);

    // Update server expiration
    const updateResult = await client.query(
      `UPDATE servers SET expires_at = $1, subscription_status = 'active'
       WHERE id = $2
       RETURNING id, server_name, expires_at, subscription_status`,
      [newExpiresAt, id]
    );

    // Create payment record for renewal
    await client.query(
      `INSERT INTO payments (user_id, server_id, plan_id, amount, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, id, server.plan_id, plan.price, 'pending']
    );

    await client.query('COMMIT');

    res.json({
      message: 'renewal_initiated',
      server: updateResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[RENEW_ERROR]', err.message, err.code, err.detail);
    res.status(500).json({ error: 'internal_error', details: err.message });
  } finally {
    client.release();
  }
});

// Admin: Get all servers (for monitoring)
router.get('/admin/all', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.user_id, s.server_name, s.status, s.subscription_status, s.expires_at,
              u.username, u.email, p.name AS plan_name
       FROM servers s
       JOIN users u ON s.user_id = u.id
       JOIN plans p ON s.plan_id = p.id
       WHERE s.is_deleted = false
       ORDER BY s.expires_at ASC`
    );

    res.json({ servers: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Customer: Get server credentials (SFTP login)
router.get('/:id/credentials', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;

  try {
    const result = await pool.query(
      `SELECT s.id, s.server_username, s.server_password, s.status, s.subscription_status
       FROM servers s
       WHERE s.id = $1 AND s.user_id = $2 AND s.is_deleted = false`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'server_not_found' });
    }

    const server = result.rows[0];

    // Only active servers have credentials
    if (server.status !== 'active') {
      return res.status(403).json({ error: 'server_not_active' });
    }

    res.json({
      credentials: {
        username: server.server_username,
        password: server.server_password,
        host: 'sftp.astra.host', // Default SFTP host
        port: 2222,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;

