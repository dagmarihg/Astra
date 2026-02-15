const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(process.cwd(), '.env');
console.log('[CONFIG] Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.warn('[CONFIG] .env not found, using defaults:', result.error.message);
}

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || 5432, 10),
    database: process.env.DB_NAME || 'astra',
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD || ''),
  },
  jwt: {
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

console.log('[CONFIG] Database config:', {
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: `<${typeof config.db.password}:${config.db.password.length} chars>`,
});

module.exports = config;
