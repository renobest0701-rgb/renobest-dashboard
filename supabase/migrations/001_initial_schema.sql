-- ============================================================
-- RENOBEST 売上・利益管理ダッシュボード
-- Migration 001: Initial Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. departments（部門）
-- ============================================================
CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO departments (name, code, sort_order) VALUES
  ('不動産仲介部門', 'REALTY',  1),
  ('新築販売部門',   'NEW_BUILD', 2),
  ('VR・CG・動画制作部門', 'VR_CG', 3);

-- ============================================================
-- 2. users（プロフィール。auth.usersと1:1）
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id    UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  department_id   UUID REFERENCES departments(id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- ============================================================
-- 3. roles（ロール定義）
-- ============================================================
CREATE TABLE roles (
  id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name  TEXT NOT NULL UNIQUE,  -- 'staff' | 'manager' | 'accounting' | 'executive'
  label TEXT NOT NULL
);

INSERT INTO roles (name, label) VALUES
  ('staff',      '一般担当者'),
  ('manager',    '部門責任者'),
  ('accounting', '経理・管理者'),
  ('executive',  '経営者');

-- ============================================================
-- 4. user_roles（ユーザーとロールの中間テーブル）
-- ============================================================
CREATE TABLE user_roles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id),  -- 部門スコープ（null=全社）
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role_id, department_id)
);

-- ============================================================
-- 5. customers（顧客・取引先）
-- ============================================================
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  company_name  TEXT,
  customer_type TEXT NOT NULL DEFAULT 'individual',  -- 'individual' | 'corporate'
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  notes         TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- ============================================================
-- 6. projects（案件：中心テーブル）
-- ============================================================
CREATE TABLE projects (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  department_id     UUID NOT NULL REFERENCES departments(id),
  customer_id       UUID REFERENCES customers(id),
  created_by        UUID NOT NULL REFERENCES users(id),

  -- ステータス
  status            TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','negotiating','prospect_b','prospect_a','application',
                      'contracted','delivered','invoiced','paid',
                      'on_hold','lost','cancelled')),

  -- 商流情報
  flow_type         TEXT NOT NULL DEFAULT 'direct'
    CHECK (flow_type IN ('direct','referral','general_contractor','realty_mediation',
                         'seller','new_build_consignment','vr_consignment','joint','other')),
  client_name       TEXT,     -- 顧客・発注者名（自由入力）
  referrer_name     TEXT,
  contractor_name   TEXT,     -- 元請会社
  renobest_role     TEXT,
  subcontractor     TEXT,
  billing_party     TEXT,
  payment_source    TEXT,
  payment_dest      TEXT,
  referral_fee      BIGINT DEFAULT 0,
  outsource_fee     BIGINT DEFAULT 0,
  profit_share      TEXT,

  -- 日付管理
  echo_date           DATE,   -- 新規反響日
  first_meeting_date  DATE,   -- 初回接客日
  application_date    DATE,   -- 申込日
  contract_plan_date  DATE,   -- 契約・受注予定日
  contract_date       DATE,   -- 契約・受注日
  delivery_plan_date  DATE,   -- 引渡し・納品予定日
  delivery_date       DATE,   -- 引渡し・納品日
  invoice_plan_date   DATE,   -- 請求予定日
  invoice_date        DATE,   -- 請求日
  payment_plan_date   DATE,   -- 入金予定日
  payment_date        DATE,   -- 入金日

  -- 金額（整数・円）
  sales_amount          BIGINT DEFAULT 0,  -- 売上予定額
  cost_planned          BIGINT DEFAULT 0,  -- 予定原価
  cost_confirmed        BIGINT DEFAULT 0,  -- 確定原価

  -- 見込み確度
  prospect_rank         TEXT DEFAULT 'b' CHECK (prospect_rank IN ('a','b','other')),

  -- メモ
  customer_memo         TEXT,
  negotiation_memo      TEXT,
  next_action_date      DATE,
  comment               TEXT,

  -- 月次締めロック
  is_locked             BOOLEAN NOT NULL DEFAULT false,

  -- 論理削除
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

-- ============================================================
-- 7. project_assignments（案件担当者）
-- ============================================================
CREATE TABLE project_assignments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id),
  assignment_role  TEXT NOT NULL DEFAULT 'main'  -- 'main' | 'sub'
    CHECK (assignment_role IN ('main','sub')),
  commission_rate  NUMERIC(5,2) DEFAULT 100.00,  -- 売上配分率(%)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

-- ============================================================
-- 8. project_status_histories（ステータス変更履歴）
-- ============================================================
CREATE TABLE project_status_histories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  changed_by    UUID NOT NULL REFERENCES users(id),
  old_status    TEXT,
  new_status    TEXT NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes         TEXT
);

-- ============================================================
-- 9. sales（売上レコード）
-- ============================================================
CREATE TABLE sales (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  amount      BIGINT NOT NULL DEFAULT 0,
  sale_type   TEXT NOT NULL
    CHECK (sale_type IN ('contract','delivered','invoiced','paid')),
  recorded_at DATE NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. costs（原価レコード）
-- ============================================================
CREATE TABLE costs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount      BIGINT NOT NULL DEFAULT 0,
  cost_type   TEXT NOT NULL CHECK (cost_type IN ('planned','confirmed')),
  description TEXT,
  recorded_at DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. promotional_expenses（販促費）
-- ============================================================
CREATE TABLE promotional_expenses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES users(id),
  department_id UUID NOT NULL REFERENCES departments(id),
  amount        BIGINT NOT NULL DEFAULT 0,
  category      TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('portal_ad','sns_ad','email','line_ad','referral_fee',
                        'travel','photo','production','print','entertainment','other')),
  description   TEXT,
  expense_month DATE NOT NULL,  -- YYYY-MM-01 形式
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. fixed_expenses（固定経費）
-- ============================================================
CREATE TABLE fixed_expenses (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES users(id),
  department_id    UUID NOT NULL REFERENCES departments(id),
  amount           BIGINT NOT NULL DEFAULT 0,
  allocation_type  TEXT NOT NULL DEFAULT 'direct'
    CHECK (allocation_type IN ('direct','equal_split')),
  description      TEXT,
  expense_month    DATE NOT NULL,  -- YYYY-MM-01 形式
  is_visible       BOOLEAN NOT NULL DEFAULT false,  -- 担当者に内訳を公開するか
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. targets（目標）
-- ============================================================
CREATE TABLE targets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id),
  department_id   UUID REFERENCES departments(id),
  target_scope    TEXT NOT NULL CHECK (target_scope IN ('personal','department','company')),
  target_period   TEXT NOT NULL CHECK (target_period IN ('monthly','yearly')),
  target_year     INTEGER NOT NULL,
  target_month    INTEGER CHECK (target_month BETWEEN 1 AND 12),  -- yearlyはNULL
  sales_target    BIGINT NOT NULL DEFAULT 0,
  profit_target   BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 14. approval_requests（変更申請）
-- ============================================================
CREATE TABLE approval_requests (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requester_id   UUID NOT NULL REFERENCES users(id),
  approver_id    UUID REFERENCES users(id),
  field_name     TEXT NOT NULL,
  old_value      TEXT,
  new_value      TEXT NOT NULL,
  reason         TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','withdrawn')),
  approved_at    TIMESTAMPTZ,
  comment        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 15. change_logs（監査ログ・変更履歴）
-- ============================================================
CREATE TABLE change_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_table        TEXT NOT NULL,
  target_id           UUID NOT NULL,
  project_id          UUID REFERENCES projects(id),
  changed_by          UUID NOT NULL REFERENCES users(id),
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  field_name          TEXT NOT NULL,
  old_value           TEXT,
  new_value           TEXT,
  reason              TEXT,
  approved_by         UUID REFERENCES users(id),
  approved_at         TIMESTAMPTZ,
  approval_result     TEXT CHECK (approval_result IN ('approved','rejected')),
  approval_comment    TEXT,
  monthly_sales_impact   BIGINT DEFAULT 0,
  monthly_profit_impact  BIGINT DEFAULT 0,
  yearly_sales_impact    BIGINT DEFAULT 0,
  yearly_profit_impact   BIGINT DEFAULT 0
);

-- ============================================================
-- 16. line_notification_settings（LINE通知設定）
-- ============================================================
CREATE TABLE line_notification_settings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  notification_type TEXT NOT NULL
    CHECK (notification_type IN ('application','contract','payment','cancel','important_change')),
  target_type      TEXT NOT NULL
    CHECK (target_type IN ('company_group','department_group','executive','assignee','admin')),
  department_id    UUID REFERENCES departments(id),
  line_group_id    TEXT,   -- LINE グループID（環境変数で管理推奨）
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 17. line_notification_logs（LINE通知ログ・二重送信防止）
-- ============================================================
CREATE TABLE line_notification_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  sent_at           TIMESTAMPTZ,
  send_target       TEXT,
  result            TEXT CHECK (result IN ('success','failed','pending')),
  line_message_id   TEXT,
  retry_count       INTEGER NOT NULL DEFAULT 0,
  error_message     TEXT,
  resent_by         UUID REFERENCES users(id),  -- 管理者による再送
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 18. monthly_closings（月次締め）
-- ============================================================
CREATE TABLE monthly_closings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id   UUID NOT NULL REFERENCES departments(id),
  year            INTEGER NOT NULL,
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  status          TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','temporary','final','amending','amended')),
  closed_by       UUID REFERENCES users(id),
  closed_at       TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id, year, month)
);

-- ============================================================
-- 19. prospect_weights（見込み確度の加重設定）
-- ============================================================
CREATE TABLE prospect_weights (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rank          TEXT NOT NULL UNIQUE CHECK (rank IN ('a','b','other')),
  weight        NUMERIC(4,2) NOT NULL DEFAULT 0.00,  -- 0.00 〜 1.00
  updated_by    UUID REFERENCES users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO prospect_weights (rank, weight) VALUES
  ('a',     0.80),
  ('b',     0.50),
  ('other', 0.00);

-- ============================================================
-- インデックス
-- ============================================================
CREATE INDEX idx_projects_department    ON projects(department_id);
CREATE INDEX idx_projects_status        ON projects(status);
CREATE INDEX idx_projects_created_by    ON projects(created_by);
CREATE INDEX idx_projects_deleted_at    ON projects(deleted_at);
CREATE INDEX idx_project_assignments_user ON project_assignments(user_id);
CREATE INDEX idx_sales_project          ON sales(project_id);
CREATE INDEX idx_sales_user             ON sales(user_id);
CREATE INDEX idx_costs_project          ON costs(project_id);
CREATE INDEX idx_promo_user             ON promotional_expenses(user_id);
CREATE INDEX idx_promo_month            ON promotional_expenses(expense_month);
CREATE INDEX idx_fixed_user             ON fixed_expenses(user_id);
CREATE INDEX idx_fixed_month            ON fixed_expenses(expense_month);
CREATE INDEX idx_targets_user           ON targets(user_id, target_year, target_month);
CREATE INDEX idx_change_logs_project    ON change_logs(project_id);
CREATE INDEX idx_line_logs_project      ON line_notification_logs(project_id, notification_type);
CREATE INDEX idx_approval_project       ON approval_requests(project_id, status);

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_departments
  BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_targets
  BEFORE UPDATE ON targets FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_approval_requests
  BEFORE UPDATE ON approval_requests FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_monthly_closings
  BEFORE UPDATE ON monthly_closings FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
