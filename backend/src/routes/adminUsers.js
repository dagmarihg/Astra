const express = require('express');
const { body, query, validationResult } = require('express-validator');
const pool = require('../../db/connection');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

function validationErrorHandler(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'validation_error', details: errors.array() });
  }
  next();
}

// List users (admin only) - supports pagination
router.get(
  '/',
  authMiddleware,
  requireRole('admin'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validationErrorHandler,
  async (req, res) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 25;
    const offset = (page - 1) * limit;

    try {
      const result = await pool.query(
        `SELECT id, email, username, role, is_active, created_at, updated_at
         FROM users
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const countResult = await pool.query('SELECT COUNT(*) AS total FROM users');
      const total = parseInt(countResult.rows[0].total, 10);

      res.json({ users: result.rows, meta: { page, limit, total } });
    } catch (err) {
      console.error('[ADMIN_USERS_LIST_ERROR]', err.message);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

// Get single user
router.get('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT id, email, username, role, is_active, created_at, updated_at FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('[ADMIN_USER_GET_ERROR]', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Update user (role, is_active)
router.put(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  [
    body('role').optional().isIn(['admin', 'customer']).withMessage('Invalid role'),
    body('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
  ],
  validationErrorHandler,
  async (req, res) => {
    const { id } = req.params;
    const { role, is_active } = req.body;
    const adminId = req.user.id;

    try {
      const result = await pool.query(
        `UPDATE users SET
           role = COALESCE($1, role),
           is_active = COALESCE($2, is_active),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, email, username, role, is_active, created_at, updated_at`,
        [role, typeof is_active === 'undefined' ? null : is_active, id]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'user_not_found' });

      // Audit
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [adminId, 'user_updated', 'user', id, 'success']
      );

      res.json({ message: 'user_updated', user: result.rows[0] });
    } catch (err) {
      console.error('[ADMIN_USER_UPDATE_ERROR]', err.message);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

// Soft-delete user (deactivate)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  try {
    const result = await pool.query(
      `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'user_not_found' });

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, 'user_deactivated', 'user', id, 'success']
    );

    res.json({ message: 'user_deactivated', user_id: id });
  } catch (err) {
    console.error('[ADMIN_USER_DELETE_ERROR]', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
