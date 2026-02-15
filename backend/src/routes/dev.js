const express = require('express');
const notifications = require('../utils/notifications');
const config = require('../config');

const router = express.Router();

// Development-only emit endpoint to help test realtime notifications.
// Controlled by DEV_TOOLS env var.
router.post('/emit', async (req, res) => {
  if (config.isProd || process.env.DEV_TOOLS !== 'true') {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { event, payload } = req.body || {};
  if (!event) return res.status(400).json({ error: 'missing_event' });

  try {
    notifications.emitToAdmins(event, payload || {});
    res.json({ message: 'emitted', event, payload });
  } catch (err) {
    console.error('[DEV_EMIT_ERROR]', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
