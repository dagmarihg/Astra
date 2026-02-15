const pool = require('../../db/connection');

// Check and expire servers whose subscription has expired
async function expireServers() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find all active servers past expiration date
    const expiredServers = await client.query(
      `SELECT id, pterodactyl_id FROM servers 
       WHERE expires_at < CURRENT_TIMESTAMP 
       AND subscription_status = 'active' 
       AND is_deleted = false`
    );

    // For each expired server, update status
    for (const server of expiredServers.rows) {
      await client.query(
        `UPDATE servers SET subscription_status = 'expired', status = 'expired' 
         WHERE id = $1`,
        [server.id]
      );

      // TODO: Call Pterodactyl API to delete or suspend the server
      // For now, just mark as expired in DB
    }

    await client.query('COMMIT');
    console.log(`[expireServers] Expired ${expiredServers.rows.length} servers`);

    return expiredServers.rows.length;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[expireServers] Error:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Get all servers expiring within N days
async function getExpiringServers(daysThreshold = 7) {
  try {
    const result = await pool.query(
      `SELECT s.id, s.user_id, s.server_name, s.expires_at,
              u.email, p.name AS plan_name
       FROM servers s
       JOIN users u ON s.user_id = u.id
       JOIN plans p ON s.plan_id = p.id
       WHERE s.expires_at BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '1 day' * $1
       AND s.subscription_status = 'active'
       AND s.is_deleted = false
       ORDER BY s.expires_at ASC`,
      [daysThreshold]
    );

    return result.rows;
  } catch (err) {
    console.error('[getExpiringServers] Error:', err);
    throw err;
  }
}

module.exports = {
  expireServers,
  getExpiringServers,
};
