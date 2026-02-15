const express = require('express');
const pool = require('../../db/connection');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

// List all active plans (public endpoint, useful for signup flow)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, price, duration_days, cpu_cores, ram_gb, storage_gb, max_players
       FROM plans WHERE is_active = true ORDER BY price ASC`
    );
    res.json({ plans: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Get single plan by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, description, price, duration_days, cpu_cores, ram_gb, storage_gb, max_players
       FROM plans WHERE id = $1 AND is_active = true`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'plan_not_found' });
    }
    res.json({ plan: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Admin: Create new plan
router.post(
  '/',
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const { name, description, price, duration_days, cpu_cores, ram_gb, storage_gb, max_players } = req.body;

    // Validation
    if (!name || !price) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO plans (name, description, price, duration_days, cpu_cores, ram_gb, storage_gb, max_players)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, description, price, duration_days, cpu_cores, ram_gb, storage_gb, max_players`,
        [name, description, price, duration_days || 30, cpu_cores, ram_gb, storage_gb, max_players]
      );

      res.status(201).json({
        message: 'plan_created',
        plan: result.rows[0],
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

// Admin: Update plan
router.put(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const { id } = req.params;
    const { name, description, price, duration_days, cpu_cores, ram_gb, storage_gb, max_players, is_active } = req.body;

    try {
      const result = await pool.query(
        `UPDATE plans SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         price = COALESCE($3, price),
         duration_days = COALESCE($4, duration_days),
         cpu_cores = COALESCE($5, cpu_cores),
         ram_gb = COALESCE($6, ram_gb),
         storage_gb = COALESCE($7, storage_gb),
         max_players = COALESCE($8, max_players),
         is_active = COALESCE($9, is_active),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $10
         RETURNING id, name, description, price, duration_days, cpu_cores, ram_gb, storage_gb, max_players, is_active`,
        [name, description, price, duration_days, cpu_cores, ram_gb, storage_gb, max_players, is_active, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'plan_not_found' });
      }

      res.json({ message: 'plan_updated', plan: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

// Admin: Delete plan (soft delete by setting is_active)
router.delete(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(
        `UPDATE plans SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'plan_not_found' });
      }

      res.json({ message: 'plan_deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

module.exports = router;
