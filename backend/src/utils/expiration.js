const pool = require('../../db/connection');
const notifications = require('./notifications');

// Advisory lock key for leader election (arbitrary 64-bit int)
const ADVISORY_LOCK_KEY = 1234567890;

/**
 * Server Expiration & Auto-Renewal Manager
 * Handles:
 * - Auto-renewal 1 day before expiry
 * - Marking servers as expired
 * - Cleanup of old deleted servers
 * - Sending expiry notifications
 */

/**
 * Start auto-renewal cron job
 * Runs every 6 hours to check for expiring servers
 */
async function startAutoRenewalCron() {
  console.log('[EXPIRATION] Starting auto-renewal cron...');

  // Run every 6 hours
  setInterval(async () => {
    try {
      await processAutoRenewals();
    } catch (err) {
      console.error('[AUTO_RENEW_ERROR]', err.message);
    }
  }, 6 * 60 * 60 * 1000);

  // Run immediately on startup
  await processAutoRenewals();
}

/**
 * Start expiration cleanup cron job
 * Runs daily to mark expired servers
 */
async function startExpirationCleanupCron() {
  console.log('[EXPIRATION] Starting cleanup cron...');

  // Run every 24 hours
  setInterval(async () => {
    try {
      await markExpiredServers();
    } catch (err) {
      console.error('[CLEANUP_ERROR]', err.message);
    }
  }, 24 * 60 * 60 * 1000);

  // Run immediately on startup
  await markExpiredServers();
}

/**
 * Process auto-renewals for servers expiring in 1 day
 */
async function processAutoRenewals() {
  try {
    // Attempt to acquire advisory lock; only proceed if we become leader
    const lockResult = await pool.query('SELECT pg_try_advisory_lock($1) as locked', [ADVISORY_LOCK_KEY]);
    if (!lockResult.rows[0].locked) {
      // Not leader, skip
      return;
    }
    // Find servers expiring in 1 day (or less) with active subscription
    const result = await pool.query(
      `SELECT s.id, s.user_id, s.plan_id, s.expires_at, p.price
       FROM servers s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.subscription_status = 'active'
       AND s.is_deleted = false
       AND s.expires_at > NOW()
       AND s.expires_at <= NOW() + INTERVAL '1 day'
       AND (
         SELECT COUNT(*) FROM payments 
         WHERE server_id = s.id 
         AND status = 'pending' 
         AND created_at > NOW() - INTERVAL '1 day'
       ) = 0`
    );

    const autoRenewals = result.rows;

    for (const server of autoRenewals) {
      try {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Create renewal payment record
          const newExpiresAt = new Date(server.expires_at);
          newExpiresAt.setDate(newExpiresAt.getDate() + 30); // Default 30 days

          await client.query(
            `INSERT INTO payments (user_id, server_id, plan_id, amount, status)
             VALUES ($1, $2, $3, $4, 'pending')`,
            [server.user_id, server.id, server.plan_id, server.price]
          );

          // Log renewal attempt
          await client.query(
            `INSERT INTO audit_logs (action, resource, resource_id, status)
             VALUES ('server_auto_renew_initiated', 'server', $1, 'pending')`,
            [server.id]
          );

          await client.query('COMMIT');

          console.log(`[AUTO_RENEW] Server ${server.id} renewal initiated (expires: ${server.expires_at})`);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } catch (err) {
        console.error(`[AUTO_RENEW_ERROR] Server ${server.id}:`, err.message);
      }
    }

    if (autoRenewals.length > 0) {
      console.log(`[AUTO_RENEW] Processed ${autoRenewals.length} servers`);
    }
    // release advisory lock
    await pool.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
  } catch (err) {
    console.error('[AUTO_RENEW_PROCESS_ERROR]', err.message);
  }
}

/**
 * Mark servers as expired if expiry date passed
 */
async function markExpiredServers() {
  try {
    // Acquire advisory lock so only one instance marks expirations
    const lockResult = await pool.query('SELECT pg_try_advisory_lock($1) as locked', [ADVISORY_LOCK_KEY]);
    if (!lockResult.rows[0].locked) {
      return;
    }
    // Find expired servers
    const result = await pool.query(
      `SELECT s.id, s.user_id, s.subscription_status
       FROM servers s
       WHERE s.subscription_status = 'active'
       AND s.is_deleted = false
       AND s.expires_at <= NOW()`
    );

    const expiredServers = result.rows;

    for (const server of expiredServers) {
      try {
        await pool.query(
          `UPDATE servers SET subscription_status = 'expired' WHERE id = $1`,
          [server.id]
        );

        console.log(`[CLEANUP] Marked server ${server.id} as expired`);
      } catch (err) {
        console.error(`[CLEANUP_ERROR] Server ${server.id}:`, err.message);
      }
    }

    if (expiredServers.length > 0) {
      console.log(`[CLEANUP] Marked ${expiredServers.length} servers as expired`);
    }
    // notify admins about expirations
    if (expiredServers.length > 0) {
      try {
        notifications.emitToAdmins('servers:expired', { count: expiredServers.length, servers: expiredServers.map(s => s.id) });
      } catch (err) {
        console.error('[NOTIFY_EXPIRY_ERROR]', err.message);
      }
    }

    // release advisory lock
    await pool.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
  } catch (err) {
    console.error('[CLEANUP_PROCESS_ERROR]', err.message);
  }
}

/**
 * Clean up old deleted servers (older than 90 days)
 */
async function cleanupDeletedServers() {
  try {
    const result = await pool.query(
      `DELETE FROM servers 
       WHERE is_deleted = true
       AND created_at < NOW() - INTERVAL '90 days'
       RETURNING id`
    );

    console.log(`[CLEANUP] Deleted ${result.rows.length} old server records`);
  } catch (err) {
    console.error('[CLEANUP_DELETED_ERROR]', err.message);
  }
}

/**
 * Get servers expiring soon (within 7 days)
 */
async function getExpiringServers() {
  try {
    const result = await pool.query(
      `SELECT s.id, s.server_name, s.expires_at, s.user_id, u.email
       FROM servers s
       JOIN users u ON s.user_id = u.id
       WHERE s.subscription_status = 'active'
       AND s.is_deleted = false
       AND s.expires_at > NOW()
       AND s.expires_at <= NOW() + INTERVAL '7 days'
       ORDER BY s.expires_at ASC`
    );

    return result.rows;
  } catch (err) {
    console.error('[EXPIRY_CHECK_ERROR]', err.message);
    return [];
  }
}

module.exports = {
  startAutoRenewalCron,
  startExpirationCleanupCron,
  processAutoRenewals,
  markExpiredServers,
  cleanupDeletedServers,
  getExpiringServers,
};
