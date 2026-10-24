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


-- =====================================================================
-- Synced tables (offline-first, POST /api/v1/sync — src/server/sync.js)
--
-- The app owns these records and generates their ids. Every synced table has:
--   updated_at  client time in ms of the last edit; the newer edit wins
--   deleted_at  set instead of deleting, so deletions reach other devices
--   server_seq  the user's sync counter when the row last changed; the app
--               pulls everything with server_seq > its cursor
-- The primary key always starts with user_id, so one user's record ids can
-- never touch another user's rows.
-- =====================================================================

-- Per-user sync counter (see server_seq above).
ALTER TABLE users ADD COLUMN IF NOT EXISTS sync_seq BIGINT UNSIGNED NOT NULL DEFAULT 0;


-- ---------------------------------------------------------------------
-- 5. habits — daily habits ("read 5 pages"). A habit shows in every week
--    from started_on until archived_on (exclusive), so new weeks pick up the
--    previous week's habits automatically.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS habits (
  user_id      BIGINT UNSIGNED NOT NULL,
  id           CHAR(36)        NOT NULL,
  title        VARCHAR(120)    NOT NULL,
  sort_order   INT             NOT NULL DEFAULT 0,
  started_on   DATE            NOT NULL,
  archived_on  DATE            NULL,
  updated_at   BIGINT UNSIGNED NOT NULL,
  deleted_at   BIGINT UNSIGNED NULL,
  server_seq   BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, id),
  KEY idx_habits_seq (user_id, server_seq),
  CONSTRAINT fk_habits_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------
-- 6. habit_marks — one mark per habit per day: done (straight line) or
--    missed (zigzag). No row = not marked; past unmarked days count as missed.
--    id is "<habit_id>_<YYYY-MM-DD>" so two devices marking the same day
--    update the same record.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS habit_marks (
  user_id      BIGINT UNSIGNED NOT NULL,
  id           VARCHAR(48)     NOT NULL,
  habit_id     CHAR(36)        NOT NULL,
  mark_date    DATE            NOT NULL,
  status       ENUM('done', 'missed') NOT NULL,
  updated_at   BIGINT UNSIGNED NOT NULL,
  deleted_at   BIGINT UNSIGNED NULL,
  server_seq   BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, id),
  KEY idx_habit_marks_seq (user_id, server_seq),
  KEY idx_habit_marks_habit (user_id, habit_id, mark_date),
  CONSTRAINT fk_habit_marks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------
-- 7. weeks — per-week data: "This week's motivation", one line shown at the
--    top of the week page. Identified by its first day; new weeks copy the
--    previous week's motivation.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weeks (
  user_id         BIGINT UNSIGNED NOT NULL,
  start_date      DATE            NOT NULL,
  motivation      VARCHAR(300)    NOT NULL DEFAULT '',
  updated_at      BIGINT UNSIGNED NOT NULL,
  deleted_at      BIGINT UNSIGNED NULL,
  server_seq      BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, start_date),
  KEY idx_weeks_seq (user_id, server_seq),
  CONSTRAINT fk_weeks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------
-- 8. weekly_tasks — things to finish sometime this week. Once the week is
--    over, a task that isn't done counts as failed (✗). Carrying it creates a
--    copy in the next week (carried_from_id) and sets carried_to_id here.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_tasks (
  user_id          BIGINT UNSIGNED NOT NULL,
  id               CHAR(36)        NOT NULL,
  week_start       DATE            NOT NULL,
  title            VARCHAR(200)    NOT NULL,
  done             BOOLEAN         NOT NULL DEFAULT FALSE,
  carried_from_id  CHAR(36)        NULL,
  carried_to_id    CHAR(36)        NULL,
  sort_order       INT             NOT NULL DEFAULT 0,
  updated_at       BIGINT UNSIGNED NOT NULL,
  deleted_at       BIGINT UNSIGNED NULL,
  server_seq       BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, id),
  KEY idx_weekly_tasks_seq (user_id, server_seq),
  KEY idx_weekly_tasks_week (user_id, week_start),
  CONSTRAINT fk_weekly_tasks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------
-- 9. reminders — quick notes ("bring X") with an optional reminder time,
--    and money entries ("give money to Y"). kind decides which fields apply:
--      note   text (required), remind_at (ms, UTC, optional), done
--      money  person, amount_minor (paise), currency, direction, done = settled
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reminders (
  user_id       BIGINT UNSIGNED NOT NULL,
  id            CHAR(36)        NOT NULL,
  kind          ENUM('note', 'money') NOT NULL,
  text          VARCHAR(500)    NOT NULL DEFAULT '',
  remind_at     BIGINT UNSIGNED NULL,
  done          BOOLEAN         NOT NULL DEFAULT FALSE,
  person        VARCHAR(100)    NULL,
  amount_minor  BIGINT UNSIGNED NULL,
  currency      CHAR(3)         NULL,
  direction     ENUM('i_owe', 'owed_to_me') NULL,
  updated_at    BIGINT UNSIGNED NOT NULL,
  deleted_at    BIGINT UNSIGNED NULL,
  server_seq    BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, id),
  KEY idx_reminders_seq (user_id, server_seq),
  CONSTRAINT fk_reminders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------
-- 10. lessons — the life lessons journal. Title and text are personal, so
--     they are stored encrypted (src/server/crypto.js); tags stay readable
--     so they can be filtered.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lessons (
  user_id      BIGINT UNSIGNED NOT NULL,
  id           CHAR(36)        NOT NULL,
  title_enc    TEXT            NOT NULL,
  body_enc     MEDIUMTEXT      NOT NULL,
  lesson_date  DATE            NOT NULL,
  tags         JSON            NOT NULL,
  updated_at   BIGINT UNSIGNED NOT NULL,
  deleted_at   BIGINT UNSIGNED NULL,
  server_seq   BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, id),
  KEY idx_lessons_seq (user_id, server_seq),
  CONSTRAINT fk_lessons_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------
-- 11. books — one row per book (title + author). Each time it is read is a
--     row in book_readings, so a re-read is a new reading of the same book.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
  user_id     BIGINT UNSIGNED NOT NULL,
  id          CHAR(36)        NOT NULL,
  title       VARCHAR(200)    NOT NULL,
  author      VARCHAR(150)    NOT NULL DEFAULT '',
  genre       VARCHAR(60)     NOT NULL DEFAULT '',
  updated_at  BIGINT UNSIGNED NOT NULL,
  deleted_at  BIGINT UNSIGNED NULL,
  server_seq  BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, id),
  KEY idx_books_seq (user_id, server_seq),
  CONSTRAINT fk_books_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------
-- 12. book_readings — one reading of a book. read_number is the tracker's
--     "Sr No" (2 = second read). Rules (src/server/sync.js): end_date can't
--     be before start_date, and a rating (1–5) needs status = completed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_readings (
  user_id      BIGINT UNSIGNED NOT NULL,
  id           CHAR(36)        NOT NULL,
  book_id      CHAR(36)        NOT NULL,
  read_number  SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  type         ENUM('hardcopy', 'softcopy', 'audiobook') NOT NULL,
  status       ENUM('planned', 'reading', 'completed') NOT NULL,
  start_date   DATE            NULL,
  end_date     DATE            NULL,
  rating       TINYINT UNSIGNED NULL,
  updated_at   BIGINT UNSIGNED NOT NULL,
  deleted_at   BIGINT UNSIGNED NULL,
  server_seq   BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, id),
  KEY idx_book_readings_seq (user_id, server_seq),
  KEY idx_book_readings_book (user_id, book_id),
  CONSTRAINT fk_book_readings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------
-- 13. reading_goals — books to finish in a year.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reading_goals (
  user_id     BIGINT UNSIGNED NOT NULL,
  year        SMALLINT UNSIGNED NOT NULL,
  target      SMALLINT UNSIGNED NOT NULL,
  updated_at  BIGINT UNSIGNED NOT NULL,
  deleted_at  BIGINT UNSIGNED NULL,
  server_seq  BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, year),
  KEY idx_reading_goals_seq (user_id, server_seq),
  CONSTRAINT fk_reading_goals_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- =====================================================================
-- Notifications and admin (not synced; read and written through the API)
-- =====================================================================

-- When the user last used the app (updated by sync at most every 10 minutes).
-- Drives the admin panel's "active users" count.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP NULL;


-- ---------------------------------------------------------------------
-- 14. announcements — messages an admin sends to all users or chosen ones.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id    BIGINT UNSIGNED NULL,                 -- NULL if that admin was deleted
  title       VARCHAR(120)    NOT NULL,
  body        VARCHAR(2000)   NOT NULL,
  audience    ENUM('all', 'selected') NOT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcements_created (created_at),
  CONSTRAINT fk_announcements_admin FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE SET NULL
);


-- ---------------------------------------------------------------------
-- 15. announcement_recipients — one row per user an announcement went to.
--     This is the in-app inbox, so it is complete even when a push never
--     arrives. push_status: pending → sent / failed / no_device / skipped
--     (push not configured).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcement_recipients (
  announcement_id  BIGINT UNSIGNED NOT NULL,
  user_id          BIGINT UNSIGNED NOT NULL,
  read_at          TIMESTAMP       NULL,
  push_status      ENUM('pending', 'sent', 'failed', 'no_device', 'skipped') NOT NULL DEFAULT 'pending',
  PRIMARY KEY (announcement_id, user_id),
  KEY idx_recipients_user (user_id, read_at),
  CONSTRAINT fk_recipients_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (id) ON DELETE CASCADE,
  CONSTRAINT fk_recipients_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------
-- 16. device_tokens — Firebase Cloud Messaging tokens of signed-in phones.
--     A token belongs to whoever signed in on that phone most recently.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_tokens (
  token         VARCHAR(255)    NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  platform      ENUM('android', 'ios') NOT NULL,
  last_seen_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token),
  KEY idx_device_tokens_user (user_id),
  CONSTRAINT fk_device_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ---------------------------------------------------------------------
-- 17. export_tokens — one-time links for "Export my data". The app asks for
--     a link, the phone's browser opens it and downloads the file. A link
--     works once, for 10 minutes; only its SHA-256 hash is stored.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS export_tokens (
  token_hash  CHAR(64)        NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  format      ENUM('json', 'xlsx') NOT NULL,
  expires_at  TIMESTAMP       NOT NULL,
  used_at     TIMESTAMP       NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY idx_export_tokens_user (user_id),
  CONSTRAINT fk_export_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- =====================================================================
-- Activity logs and app-wide settings (admin panel → Logs, Log settings)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 18. app_settings — small app-wide settings an admin can change, stored
--     as JSON by key (e.g. "logs" → which log types are on, retention days).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key  VARCHAR(64)     NOT NULL,
  value        JSON            NOT NULL,
  updated_by   BIGINT UNSIGNED NULL,
  updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
);


-- ---------------------------------------------------------------------
-- 19. activity_logs — who did what, when (src/server/logs.js).
--     category: security | admin | usage — each can be switched off.
--     user_id:  the account the event is about; actor_id: who did it (an
--     admin, for admin events). No foreign keys, so entries outlive deleted
--     accounts until the retention period removes them. details never holds
--     passwords, codes, tokens or anything a user wrote.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at  TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  category    ENUM('security', 'admin', 'usage') NOT NULL,
  event       VARCHAR(64)     NOT NULL,
  user_id     BIGINT UNSIGNED NULL,
  actor_id    BIGINT UNSIGNED NULL,
  email       VARCHAR(254)    NULL,                 -- snapshot, readable after the account is gone
  ip          VARCHAR(64)     NULL,
  user_agent  VARCHAR(255)    NULL,
  details     JSON            NULL,
  PRIMARY KEY (id),
  KEY idx_activity_logs_time (created_at),
  KEY idx_activity_logs_user (user_id, created_at),
  KEY idx_activity_logs_category (category, created_at)
);
