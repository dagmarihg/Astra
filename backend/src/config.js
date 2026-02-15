const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || 5432, 10),
    database: process.env.DB_NAME || 'astra',
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD || ''),
  },
  jwt: {
    // Do not fallback to a weak default in production
    secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-prod',
    expiry: process.env.JWT_EXPIRY || '7d',
  },
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  },
};

// Fail fast in production for missing critical secrets
if (config.isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error('[CONFIG] JWT_SECRET is required in production and must be at least 32 characters.');
  process.exit(1);
}

// Log non-sensitive configuration for visibility
console.log('[CONFIG] Loaded configuration:', {
  nodeEnv: config.nodeEnv,
  port: config.port,
  db: {
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
  },
  corsOrigin: config.cors.origin,
});

module.exports = config;
