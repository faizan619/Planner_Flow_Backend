-- =====================================================================
-- Planner Flow — TiDB / MySQL schema
--
-- Applied automatically on `next dev` start (src/instrumentation.js) or
-- manually with `npm run db:setup`. Every statement is idempotent, so
-- running it again is safe. Add new tables with CREATE TABLE IF NOT EXISTS
-- and new columns with ALTER TABLE … ADD COLUMN IF NOT EXISTS.
--
-- Order matters: tables referenced by foreign keys are created first.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. users — app users and admins, separated by `role`.
--    timezone / week_start_day decide what "today" and "this week" mean.
--    week_start_day: 1 = Monday … 7 = Sunday (ISO weekday numbers).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name               VARCHAR(100)    NOT NULL,
  email              VARCHAR(254)    NOT NULL,              -- stored lower-case
  password_hash      VARCHAR(255)    NOT NULL,              -- argon2id
  role               ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  status             ENUM('active', 'deactivated') NOT NULL DEFAULT 'active',
  timezone           VARCHAR(64)     NOT NULL DEFAULT 'Asia/Kolkata',
  week_start_day     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  currency           CHAR(3)         NOT NULL DEFAULT 'INR',
  email_verified_at  TIMESTAMP       NULL,
  last_login_at      TIMESTAMP       NULL,
  created_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
);


-- ---------------------------------------------------------------------
-- 2. refresh_tokens — one row per issued refresh token (only its SHA-256
--    hash is stored). Each login starts a `family`; every refresh revokes
--    the used token and issues the next one in the same family. Presenting
--    an already-revoked token means it was stolen, so the whole family is
--    revoked (src/server/auth/tokens.js).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  family_id    CHAR(36)        NOT NULL,
  token_hash   CHAR(64)        NOT NULL,
  expires_at   TIMESTAMP       NOT NULL,
  revoked_at   TIMESTAMP       NULL,
  replaced_by  BIGINT UNSIGNED NULL,
  user_agent   VARCHAR(255)    NULL,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_tokens_hash (token_hash),
  KEY idx_refresh_tokens_user (user_id),
  KEY idx_refresh_tokens_family (family_id),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------
-- 3. email_codes — 6-digit codes for email verification and password
--    reset. Only an HMAC of the code is stored; 5 wrong tries burn it.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_codes (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  purpose     ENUM('verify', 'reset') NOT NULL,
  code_hash   CHAR(64)        NOT NULL,
  expires_at  TIMESTAMP       NOT NULL,
  attempts    INT UNSIGNED    NOT NULL DEFAULT 0,
  used_at     TIMESTAMP       NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_email_codes_user (user_id, purpose),
  CONSTRAINT fk_email_codes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------
-- 4. rate_limits — fixed-window counters (src/server/rateLimit.js). Kept
--    in the database because Vercel functions don't share memory.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket        VARCHAR(191)  NOT NULL,              -- e.g. "login:ip:1.2.3.4"
  window_start  TIMESTAMP     NOT NULL,
  hits          INT UNSIGNED  NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket)
);
