-- Astra Database Schema (PostgreSQL)

-- Create roles enum
CREATE TYPE user_role AS ENUM ('admin', 'customer');

-- Create subscription status enum
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled');

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Plans table (Admin manages these)
CREATE TABLE plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  duration_days INTEGER DEFAULT 30,
  cpu_cores INTEGER,
  ram_gb DECIMAL(5, 2),
  storage_gb DECIMAL(10, 2),
  max_players INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Servers table (Customer server instances)
CREATE TABLE servers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  server_name VARCHAR(100) NOT NULL,
  pterodactyl_id VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, stopped, expired, deleted
  ip_address VARCHAR(50),
  port INTEGER,
  server_username VARCHAR(100),
  server_password VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  subscription_status subscription_status DEFAULT 'active',
  is_deleted BOOLEAN DEFAULT false
);

-- Create indexes for frequent queries
CREATE INDEX idx_servers_user_id ON servers(user_id);
CREATE INDEX idx_servers_plan_id ON servers(plan_id);
CREATE INDEX idx_servers_status ON servers(status);
CREATE INDEX idx_servers_expires_at ON servers(expires_at);
CREATE INDEX idx_servers_subscription_status ON servers(subscription_status);

-- Payments table (for manual UPI approval)
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  utr VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  rejection_reason TEXT,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- Audit log table for security
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  resource_id VARCHAR(100),
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
