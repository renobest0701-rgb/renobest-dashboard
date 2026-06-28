-- ============================================================
-- Migration 005: CRM Phase 1
-- customers拡張 + deals / tasks / action_logs / sync_logs
-- ============================================================

-- ============================================================
-- 1. customers テーブル拡張
-- ============================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS line_name          TEXT,
  ADD COLUMN IF NOT EXISTS language           TEXT DEFAULT 'ja',
  ADD COLUMN IF NOT EXISTS rank               TEXT DEFAULT 'c'
    CHECK (rank IN ('a','b','c','d')),
  ADD COLUMN IF NOT EXISTS source             TEXT,
  ADD COLUMN IF NOT EXISTS assigned_user_id   UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS status             TEXT DEFAULT 'active'
    CHECK (status IN ('active','inactive','lost')),
  ADD COLUMN IF NOT EXISTS first_contact_status TEXT DEFAULT 'not_contacted'
    CHECK (first_contact_status IN ('not_contacted','contacted','meeting_set')),
  ADD COLUMN IF NOT EXISTS last_contact_date  DATE,
  ADD COLUMN IF NOT EXISTS next_action_date   DATE,
  ADD COLUMN IF NOT EXISTS external_id          TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS sync_source          TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS spreadsheet_row_id   TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_rank ON customers(rank);
CREATE INDEX IF NOT EXISTS idx_customers_assigned_user ON customers(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_customers_next_action ON customers(next_action_date);
CREATE INDEX IF NOT EXISTS idx_customers_external_id ON customers(external_id);

-- ============================================================
-- 2. deals テーブル（CRM案件。既存projectsと別管理）
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id             UUID NOT NULL REFERENCES customers(id),
  assigned_user_id        UUID REFERENCES users(id),
  department_id           UUID REFERENCES departments(id),

  deal_type               TEXT NOT NULL DEFAULT 'purchase'
    CHECK (deal_type IN ('purchase','sell','rent','other')),
  property_name           TEXT,
  property_address        TEXT,
  property_price          BIGINT,
  budget                  BIGINT,
  purpose                 TEXT,
  interest_points         TEXT,
  concerns                TEXT,

  deal_status             TEXT NOT NULL DEFAULT 'inquiry'
    CHECK (deal_status IN (
      'inquiry','negotiating','proposal','application',
      'contracted','delivered','payment_pending','paid',
      'on_hold','lost'
    )),
  probability             INTEGER DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),

  expected_sales          BIGINT DEFAULT 0,
  expected_profit         BIGINT DEFAULT 0,
  confirmed_sales         BIGINT DEFAULT 0,
  confirmed_profit        BIGINT DEFAULT 0,

  contract_expected_date  DATE,
  handover_expected_date  DATE,
  payment_expected_date   DATE,
  contract_date           DATE,
  handover_date           DATE,
  payment_date            DATE,

  memo                    TEXT,

  sync_source             TEXT DEFAULT 'manual',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deals_customer ON deals(customer_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(deal_status);
CREATE INDEX IF NOT EXISTS idx_deals_assigned ON deals(assigned_user_id);

-- ============================================================
-- 3. tasks テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID REFERENCES customers(id),
  deal_id         UUID REFERENCES deals(id),
  assigned_user_id UUID REFERENCES users(id),
  created_by      UUID REFERENCES users(id),

  task_title      TEXT NOT NULL,
  task_type       TEXT NOT NULL DEFAULT 'other'
    CHECK (task_type IN (
      'first_contact','phone','line_msg','email','meeting',
      'document_send','contract_followup','payment_followup',
      'follow_up','set_next_date','other'
    )),
  priority        TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high','medium','low')),

  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','cancelled')),

  auto_generated  BOOLEAN NOT NULL DEFAULT false,
  auto_rule       TEXT,  -- どのルールで生成されたか記録

  completed_at    TIMESTAMPTZ,
  completion_note TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_customer ON tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ============================================================
-- 4. action_logs テーブル（行動履歴）
-- ============================================================
CREATE TABLE IF NOT EXISTS action_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID REFERENCES customers(id),
  deal_id         UUID REFERENCES deals(id),
  task_id         UUID REFERENCES tasks(id),
  user_id         UUID REFERENCES users(id),

  action_type     TEXT NOT NULL
    CHECK (action_type IN (
      'call','line_msg','email','meeting','document_send',
      'contract','payment','note','status_change','other'
    )),
  action_detail   TEXT,
  result          TEXT,

  actioned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_logs_customer ON action_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_user ON action_logs(user_id);

-- ============================================================
-- 5. sync_logs テーブル（GAS同期ログ）
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sync_type     TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'google_sheets',
  sheet_name    TEXT,
  status        TEXT NOT NULL CHECK (status IN ('success','error','duplicate')),
  payload       JSONB,
  result        JSONB,
  error_message TEXT,
  row_number    INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. updated_at トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'deals_updated_at') THEN
    CREATE TRIGGER deals_updated_at
      BEFORE UPDATE ON deals
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tasks_updated_at') THEN
    CREATE TRIGGER tasks_updated_at
      BEFORE UPDATE ON tasks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- 7. RLS ポリシー
-- ============================================================
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- deals: 全ログインユーザーが閲覧、自分の案件を編集、管理者は全て
CREATE POLICY deals_select ON deals FOR SELECT
  TO authenticated USING (deleted_at IS NULL);

CREATE POLICY deals_insert ON deals FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY deals_update ON deals FOR UPDATE
  TO authenticated USING (true);

-- tasks: 全ログインユーザーが閲覧・作成、担当者が編集
CREATE POLICY tasks_select ON tasks FOR SELECT
  TO authenticated USING (true);

CREATE POLICY tasks_insert ON tasks FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY tasks_update ON tasks FOR UPDATE
  TO authenticated USING (true);

-- action_logs: 全ログインユーザーが閲覧・作成
CREATE POLICY action_logs_select ON action_logs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY action_logs_insert ON action_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- sync_logs: 管理者のみ閲覧（service roleはRLSバイパス）
CREATE POLICY sync_logs_select ON sync_logs FOR SELECT
  TO authenticated USING (true);

-- ============================================================
-- 8. google_sync_settings テーブル（admin/google-sync用）
-- ============================================================
CREATE TABLE IF NOT EXISTS google_sync_settings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key   TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE google_sync_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY google_sync_settings_select ON google_sync_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY google_sync_settings_all ON google_sync_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- デフォルト設定値を挿入
INSERT INTO google_sync_settings (setting_key, setting_value, description) VALUES
  ('spreadsheet_id', '', 'GoogleスプレッドシートのID'),
  ('customer_sheet_name', '顧客登録', '顧客管理シート名'),
  ('property_sheet_name', '物件管理', '物件管理シート名'),
  ('last_customer_sync', NULL, '最終顧客同期日時')
ON CONFLICT (setting_key) DO NOTHING;
