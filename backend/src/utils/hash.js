const bcrypt = require('bcrypt');
const config = require('../config');

async function hashPassword(plainPassword) {
  try {
    const hash = await bcrypt.hash(plainPassword, config.bcrypt.rounds);
    return hash;
  } catch (err) {
    throw new Error(`Password hashing failed: ${err.message}`);
  }
}

async function verifyPassword(plainPassword, hash) {
  try {
    return await bcrypt.compare(plainPassword, hash);
  } catch (err) {
    throw new Error(`Password verification failed: ${err.message}`);
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
};
