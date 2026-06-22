-- ============================================================
-- Migration 003: Phase 3 / Phase 4 スキーマ修正
-- ============================================================

-- ------------------------------------------------------------
-- 1. monthly_closings
--    - year/month → closing_year/closing_month に統一
--    - department_id を NULL 許容（全社締め対応）
--    - UNIQUE 制約を再定義
-- ------------------------------------------------------------
ALTER TABLE monthly_closings
  ADD COLUMN IF NOT EXISTS closing_year  INTEGER,
  ADD COLUMN IF NOT EXISTS closing_month INTEGER CHECK (closing_month BETWEEN 1 AND 12);

-- 既存データがある場合はコピー
UPDATE monthly_closings
SET closing_year  = year,
    closing_month = month
WHERE closing_year IS NULL;

-- 元カラムを削除（既存データがない前提の初期環境では DROP、
-- データ移行済みなら ALTER COLUMN SET NOT NULL を分けて実行）
ALTER TABLE monthly_closings
  DROP COLUMN IF EXISTS year,
  DROP COLUMN IF EXISTS month;

ALTER TABLE monthly_closings
  ALTER COLUMN closing_year  SET NOT NULL,
  ALTER COLUMN closing_month SET NOT NULL;

-- department_id を NULL 許容（全社締め）
ALTER TABLE monthly_closings
  ALTER COLUMN department_id DROP NOT NULL;

-- UNIQUE 制約を再定義（NULL は UNIQUE 対象外なので部分インデックスで補完）
ALTER TABLE monthly_closings
  DROP CONSTRAINT IF EXISTS monthly_closings_department_id_year_month_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_closings_dept_year_month
  ON monthly_closings (closing_year, closing_month, department_id)
  WHERE department_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_closings_company_year_month
  ON monthly_closings (closing_year, closing_month)
  WHERE department_id IS NULL;

-- ------------------------------------------------------------
-- 2. approval_requests: rejection_reason カラムを追加
-- ------------------------------------------------------------
ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ------------------------------------------------------------
-- 3. change_logs: created_at エイリアスを追加（changed_at のコピー）
--    + target_id を TEXT に変更（承認ワークフローで 'new' を許可）
-- ------------------------------------------------------------
ALTER TABLE change_logs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 既存レコードを changed_at でバックフィル
UPDATE change_logs SET created_at = changed_at WHERE created_at IS NULL;

-- target_id を TEXT 型へ変更（UUID 制約を緩和）
ALTER TABLE change_logs
  ALTER COLUMN target_id TYPE TEXT USING target_id::TEXT;

-- ------------------------------------------------------------
-- 4. line_notification_logs: updated_at カラムを追加
-- ------------------------------------------------------------
ALTER TABLE line_notification_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- update 時に自動更新するトリガー
CREATE TRIGGER set_updated_at_line_notification_logs
  BEFORE UPDATE ON line_notification_logs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ------------------------------------------------------------
-- 5. インデックス補完
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_monthly_closings_year_month
  ON monthly_closings (closing_year, closing_month);

CREATE INDEX IF NOT EXISTS idx_change_logs_created_at
  ON change_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status
  ON approval_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_line_logs_result
  ON line_notification_logs (result, updated_at)
  WHERE result = 'failed';
