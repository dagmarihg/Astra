const crypto = require('crypto');

/**
 * Credentials Management Utility
 * Handles SFTP and server login credential generation
 */

/**
 * Generate SFTP credentials for a server
 * @param {number} serverId - Server ID
 * @returns {Object} { username, password }
 */
function generateSFTPCredentials(serverId) {
  // Username format: user_[serverId]
  const username = `user_${serverId}`;
  
  // Generate strong random password (16-20 chars)
  const password = crypto.randomBytes(12).toString('base64').slice(0, 16);
  
  return { username, password };
}

/**
 * Generate game server credentials
 * @param {number} serverId - Server ID
 * @param {string} gameType - Game type (java, bedrock, etc)
 * @returns {Object} { operator_name, operator_pass }
 */
function generateGameCredentials(serverId, gameType = 'java') {
  const operatorName = `operator_${serverId}`;
  const operatorPass = crypto.randomBytes(8).toString('hex');
  
  return { operatorName, operatorPass };
}

/**
 * Generate secure random password
 * @param {number} length - Password length (default 16)
 * @returns {string} Random password
 */
function generatePassword(length = 16) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/**
 * Generate UUID for subdomain
 * @returns {string} UUID
 */
function generateSubdomain() {
  return crypto.randomUUID().split('-')[0]; // Use first part of UUID
}

module.exports = {
  generateSFTPCredentials,
  generateGameCredentials,
  generatePassword,
  generateSubdomain,
};
