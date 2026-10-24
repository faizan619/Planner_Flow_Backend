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
-- 1. tasks — starter table used by /api/tasks. Change freely.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(200)    NOT NULL,
  notes        TEXT            NULL,
  due_at       TIMESTAMP       NULL,
  is_done      BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tasks_due_at (due_at)
);
