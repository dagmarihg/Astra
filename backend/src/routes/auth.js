const express = require('express');
const pool = require('../../db/connection');
const { hashPassword, verifyPassword } = require('../utils/hash');
const { generateToken } = require('../utils/jwt');
const { validateSignup, validateLogin } = require('../middleware/validation');

const router = express.Router();

// Signup endpoint
router.post('/signup', validateSignup, async (req, res) => {
  const { email, username, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'user_exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (email, username, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, username, role',
      [email, username, passwordHash, 'customer']
    );

    const user = result.rows[0];
    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    res.status(201).json({
      message: 'signup_success',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Login endpoint
router.post('/login', validateLogin, async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const result = await pool.query(
      'SELECT id, email, username, role, password_hash FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const user = result.rows[0];
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    res.json({
      message: 'login_success',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
