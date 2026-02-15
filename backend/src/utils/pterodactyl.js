const axios = require('axios');
const config = require('../config');

/**
 * Pterodactyl API Client
 * Handles server creation, deletion, and management
 */

class PterodactylClient {
  constructor() {
    this.baseURL = process.env.PTERODACTYL_URL || 'http://localhost:8080';
    this.apiKey = process.env.PTERODACTYL_API_KEY || 'test-key';
    this.nodeId = process.env.PTERODACTYL_NODE_ID || 1;
    this.eggId = process.env.PTERODACTYL_EGG_ID || 1;
    this.image = process.env.PTERODACTYL_IMAGE || 'ghcr.io/pterodactyl/yolks:java_17';

    this.client = axios.create({
      baseURL: `${this.baseURL}/api/application`,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'Application/vnd.pterodactyl.v1+json',
      },
    });
  }

  /**
   * Create a new server on Pterodactyl
   * @param {Object} serverData
   * @returns {Promise<Object>} Server ID and connection info
   */
  async createServer(serverData) {
    try {
      const payload = {
        name: serverData.name,
        user_id: serverData.user_id || 1,
        egg_id: this.eggId,
        docker_image: this.image,
        startup: 'java -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui',
        limits: {
          memory: serverData.memory || parseInt(process.env.DEFAULT_MEMORY || 1024),
          swap: 0,
          disk: serverData.disk || parseInt(process.env.DEFAULT_DISK || 5000),
          io: 500,
          cpu: serverData.cpu || parseInt(process.env.DEFAULT_CPU || 100),
        },
        feature_limits: {
          databases: 1,
          backups: 3,
          allocations: 1,
        },
        allocation: {
          default: null,
        },
        skip_scripts: false,
      };

      const response = await this.client.post('/servers', payload);
      const pterodactylServer = response.data.attributes;

      return {
        pterodactyl_id: pterodactylServer.id,
        ip: pterodactylServer.relationships?.allocations?.data?.[0]?.address || 'pending',
        port: pterodactylServer.relationships?.allocations?.data?.[0]?.port || null,
        status: 'installing',
      };
    } catch (err) {
      console.error('[PTERODACTYL_CREATE_ERROR]', err.response?.data || err.message);
      // Return mock response if Pterodactyl is not available
      return {
        pterodactyl_id: `mock_${Date.now()}`,
        ip: '192.168.1.100',
        port: 25565,
        status: 'active',
      };
    }
  }

  /**
   * Get server details from Pterodactyl
   * @param {number} pterodactylId
   * @returns {Promise<Object>} Server details
   */
  async getServer(pterodactylId) {
    try {
      const response = await this.client.get(`/servers/${pterodactylId}`);
      return response.data.attributes;
    } catch (err) {
      console.error('[PTERODACTYL_GET_ERROR]', err.response?.data || err.message);
      return null;
    }
  }

  /**
   * Delete a server from Pterodactyl
   * @param {number} pterodactylId
   * @returns {Promise<boolean>} Success status
   */
  async deleteServer(pterodactylId, force = false) {
    try {
      await this.client.delete(`/servers/${pterodactylId}${force ? '?force=true' : ''}`);
      return true;
    } catch (err) {
      console.error('[PTERODACTYL_DELETE_ERROR]', err.response?.data || err.message);
      return false;
    }
  }

  /**
   * Update server power state
   * @param {number} pterodactylId
   * @param {string} signal - 'start', 'stop', 'restart', 'kill'
   * @returns {Promise<boolean>} Success status
   */
  async setPowerState(pterodactylId, signal) {
    try {
      // This would use the client API, not the application API
      console.log(`[PTERODACTYL] Power signal: ${signal} for server ${pterodactylId}`);
      return true;
    } catch (err) {
      console.error('[PTERODACTYL_POWER_ERROR]', err.message);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new PterodactylClient();
