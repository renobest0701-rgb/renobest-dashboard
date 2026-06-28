-- ============================================================
-- Migration 006: properties テーブル + google_sync_settings
-- ============================================================

-- ============================================================
-- 1. properties テーブル（仲介物件管理）
-- ============================================================
CREATE TABLE IF NOT EXISTS properties (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_name         TEXT NOT NULL,
  property_type         TEXT DEFAULT 'mansion'
    CHECK (property_type IN ('mansion','house','land','building','other')),
  address               TEXT,
  price                 BIGINT,
  publish_status        TEXT DEFAULT 'unpublished'
    CHECK (publish_status IN ('published','unpublished','draft')),
  sales_status          TEXT DEFAULT 'active'
    CHECK (sales_status IN ('active','under_contract','sold','withdrawn','other')),
  owner_type            TEXT DEFAULT 'individual'
    CHECK (owner_type IN ('individual','corporate','other')),
  assigned_user_id      UUID REFERENCES users(id),
  company_project_flag  BOOLEAN DEFAULT false,
  memo                  TEXT,

  -- 同期管理
  spreadsheet_row_id    TEXT UNIQUE, -- シート名:行番号 or カスタムID
  sync_source           TEXT DEFAULT 'manual',
  external_id           TEXT UNIQUE, -- 物件名+価格 or 物件名+所在地ハッシュ

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_properties_assigned ON properties(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(sales_status);
CREATE INDEX IF NOT EXISTS idx_properties_external_id ON properties(external_id);
CREATE INDEX IF NOT EXISTS idx_properties_spreadsheet_row ON properties(spreadsheet_row_id);

-- ============================================================
-- 2. properties updated_at トリガー
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'properties_updated_at') THEN
    CREATE TRIGGER properties_updated_at
      BEFORE UPDATE ON properties
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- 3. customers に spreadsheet_row_id を追加
-- ============================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS spreadsheet_row_id TEXT UNIQUE;

-- ============================================================
-- 4. deals に property_id を追加（物件テーブルとの連携）
-- ============================================================
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id),
  ADD COLUMN IF NOT EXISTS spreadsheet_row_id TEXT UNIQUE;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id);

-- ============================================================
-- 5. google_sync_settings 追加設定レコード
--    テーブル自体は005で作成済み。updated_byカラムと追加レコードのみ追加
-- ============================================================
ALTER TABLE google_sync_settings
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

INSERT INTO google_sync_settings (setting_key, setting_value, description)
VALUES
  ('last_property_sync', NULL, '最終物件同期日時'),
  ('auto_sync_enabled', 'false', '自動同期有効フラグ')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 6. sync_logs に sheet_name カラム追加
-- ============================================================
ALTER TABLE sync_logs
  ADD COLUMN IF NOT EXISTS sheet_name TEXT;

-- ============================================================
-- 7. RLS ポリシー
-- ============================================================
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_sync_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY properties_select ON properties FOR SELECT
  TO authenticated USING (deleted_at IS NULL);

CREATE POLICY properties_insert ON properties FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY properties_update ON properties FOR UPDATE
  TO authenticated USING (true);

-- google_sync_settings の RLS・ポリシーは 005 で設定済みのため省略
