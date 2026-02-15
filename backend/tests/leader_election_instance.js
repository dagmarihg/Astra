const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Load .env if present (test runner may be executed from repo root)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'astra',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD && process.env.DB_PASSWORD.length > 0 ? process.env.DB_PASSWORD : undefined,
});

const KEY = 1234567890;

async function runInstance(name, holdMs = 5000) {
  try {
    const res = await pool.query('SELECT pg_try_advisory_lock($1) as locked', [KEY]);
    const locked = res.rows[0].locked;
    console.log(`${name}: try_advisory_lock -> ${locked}`);
    if (locked) {
      console.log(`${name}: I am leader; holding lock for ${holdMs}ms`);
      await new Promise(r => setTimeout(r, holdMs));
      await pool.query('SELECT pg_advisory_unlock($1)', [KEY]);
      console.log(`${name}: released lock`);
    } else {
      console.log(`${name}: not leader`);
    }
  } catch (err) {
    console.error(`${name}: error`, err.message);
  } finally {
    await pool.end();
  }
}

const name = process.argv[2] || 'inst';
const hold = parseInt(process.argv[3] || '5000', 10);
runInstance(name, hold).then(() => process.exit(0));
