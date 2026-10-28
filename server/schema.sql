-- Prestige Campus Lost & Found: database schema (MySQL 8)
--
-- Create everything:     mysql -u root -p < schema.sql
-- Then add sample data:  npm run seed
--
-- Safe to run on an existing database: every table uses CREATE TABLE IF NOT EXISTS,
-- so existing tables and their data are left alone and only missing tables are added.
-- The database name must match DB_NAME in server/.env.

CREATE DATABASE IF NOT EXISTS prestige_db CHARACTER SET utf8mb4;
USE prestige_db;

-- Students. `id` is the internal number; `student_id` is the student's own school ID (e.g. SU-1001).
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  student_id VARCHAR(50) NOT NULL UNIQUE,
  school VARCHAR(150) NOT NULL,              -- school name, e.g. 'Strathmore University'
  email VARCHAR(160) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,            -- bcrypt hash, never the plain password
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Found items. Status flow: FOUND -> CLAIMED (someone has claimed it) -> RETURNED (owner approved).
-- CLOSED is for items the finder takes down.
CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,             -- Electronics, Clothing, Documents, Accessories, Other
  location VARCHAR(150) NOT NULL,
  date_found DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'FOUND',
  student_id INT NOT NULL,                   -- the finder: users.id
  school VARCHAR(150) NOT NULL,
  reward_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,   -- in KSh
  image_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_items_school_status (school, status),
  CONSTRAINT fk_items_finder FOREIGN KEY (student_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ownership claims. Status: PENDING, APPROVED or REJECTED.
CREATE TABLE IF NOT EXISTS claims (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  student_id INT NOT NULL,                   -- the claimant: users.id
  evidence TEXT NOT NULL,                    -- why they believe it is theirs
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_claims_item (item_id),
  INDEX idx_claims_student_status (student_id, status),
  CONSTRAINT fk_claims_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT fk_claims_student FOREIGN KEY (student_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,                      -- who receives it: users.id
  message VARCHAR(500) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id, is_read),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- New for the partner contract (openapi.yaml): fees and refunds on claims.
-- Amounts are whole cents (10000 = KSh 100.00), as the contract promises.
-- These have no foreign keys on purpose, so they can be added to an existing
-- database even if its claims.id column type differs slightly. The server
-- deletes a claim's fees and refunds itself when the claim is deleted.
-- ---------------------------------------------------------------------------

-- A handling fee, created when a claim is approved (one per claim).
CREATE TABLE IF NOT EXISTS fees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  claim_id INT NOT NULL UNIQUE,
  amount_payable_cents INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Refunds of a claim's fee. A claim can have several (partial refunds), never more than the fee.
CREATE TABLE IF NOT EXISTS refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  claim_id INT NOT NULL,
  student_id INT NOT NULL,                   -- the claimant: users.id
  amount_cents INT NOT NULL,
  reason VARCHAR(500) NOT NULL,
  refunded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_refunds_claim (claim_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
