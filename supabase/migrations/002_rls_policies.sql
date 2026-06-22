-- ============================================================
-- Migration 002: Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_status_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotional_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_weights ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper functions for role checks
-- ============================================================

-- 現在のユーザーのusers.idを返す
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 現在のユーザーが指定ロールを持つか
CREATE OR REPLACE FUNCTION has_role(role_name TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth_user_id()
      AND r.name = role_name
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 現在のユーザーが指定部門の部門責任者か
CREATE OR REPLACE FUNCTION is_dept_manager(dept_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth_user_id()
      AND r.name = 'manager'
      AND (ur.department_id = dept_id OR ur.department_id IS NULL)
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 経理または経営者か
CREATE OR REPLACE FUNCTION is_admin_or_executive()
RETURNS BOOLEAN AS $$
  SELECT has_role('accounting') OR has_role('executive');
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- departments: 全員読み取り、管理者のみ変更
-- ============================================================
CREATE POLICY "departments_select_all" ON departments FOR SELECT USING (true);
CREATE POLICY "departments_modify_admin" ON departments FOR ALL
  USING (is_admin_or_executive());

-- ============================================================
-- users: 全員自分を読み取り、管理者は全員
-- ============================================================
CREATE POLICY "users_select_own" ON users FOR SELECT
  USING (auth_user_id = auth.uid() OR is_admin_or_executive());
CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (auth_user_id = auth.uid());
CREATE POLICY "users_admin_all" ON users FOR ALL
  USING (is_admin_or_executive());

-- ============================================================
-- roles / user_roles: 読み取りは全員
-- ============================================================
CREATE POLICY "roles_select_all" ON roles FOR SELECT USING (true);
CREATE POLICY "user_roles_select_all" ON user_roles FOR SELECT
  USING (user_id = auth_user_id() OR is_admin_or_executive());
CREATE POLICY "user_roles_admin" ON user_roles FOR ALL
  USING (is_admin_or_executive());

-- ============================================================
-- customers: 自部門案件に紐づく顧客、管理者は全員
-- ============================================================
CREATE POLICY "customers_select" ON customers FOR SELECT
  USING (
    deleted_at IS NULL AND (
      is_admin_or_executive() OR
      created_by = auth_user_id() OR
      EXISTS (
        SELECT 1 FROM projects p WHERE p.customer_id = customers.id
          AND (p.created_by = auth_user_id()
            OR EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id = p.id AND pa.user_id = auth_user_id()))
      )
    )
  );
CREATE POLICY "customers_insert" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "customers_admin" ON customers FOR ALL USING (is_admin_or_executive());

-- ============================================================
-- projects: 自分担当 or 部門責任者 or 管理者
-- ============================================================
CREATE POLICY "projects_select" ON projects FOR SELECT
  USING (
    deleted_at IS NULL AND (
      created_by = auth_user_id() OR
      EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id = id AND pa.user_id = auth_user_id()) OR
      is_dept_manager(department_id) OR
      is_admin_or_executive()
    )
  );

CREATE POLICY "projects_insert" ON projects FOR INSERT
  WITH CHECK (created_by = auth_user_id() OR is_admin_or_executive());

CREATE POLICY "projects_update" ON projects FOR UPDATE
  USING (
    is_locked = false AND (
      created_by = auth_user_id() OR
      EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id = id AND pa.user_id = auth_user_id()) OR
      is_dept_manager(department_id) OR
      is_admin_or_executive()
    )
  );

CREATE POLICY "projects_admin_locked" ON projects FOR UPDATE
  USING (is_admin_or_executive());  -- 管理者はロック後も変更可（承認後）

-- ============================================================
-- project_assignments, project_status_histories
-- ============================================================
CREATE POLICY "proj_assign_select" ON project_assignments FOR SELECT
  USING (
    user_id = auth_user_id() OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id
      AND (p.created_by = auth_user_id() OR is_dept_manager(p.department_id))) OR
    is_admin_or_executive()
  );
CREATE POLICY "proj_assign_admin" ON project_assignments FOR ALL
  USING (is_admin_or_executive() OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.created_by = auth_user_id()));

CREATE POLICY "proj_status_hist_select" ON project_status_histories FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id
      AND (p.created_by = auth_user_id() OR
           EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id = p.id AND pa.user_id = auth_user_id()) OR
           is_dept_manager(p.department_id) OR
           is_admin_or_executive()))
  );
CREATE POLICY "proj_status_hist_insert" ON project_status_histories FOR INSERT
  WITH CHECK (changed_by = auth_user_id() OR is_admin_or_executive());

-- ============================================================
-- sales, costs: 自案件のみ
-- ============================================================
CREATE POLICY "sales_select" ON sales FOR SELECT
  USING (
    user_id = auth_user_id() OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id
      AND (is_dept_manager(p.department_id) OR is_admin_or_executive()))
  );
CREATE POLICY "sales_insert" ON sales FOR INSERT
  WITH CHECK (user_id = auth_user_id() OR is_admin_or_executive());
CREATE POLICY "sales_admin" ON sales FOR ALL USING (is_admin_or_executive());

CREATE POLICY "costs_select" ON costs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id = project_id AND pa.user_id = auth_user_id()) OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id
      AND (is_dept_manager(p.department_id) OR is_admin_or_executive()))
  );
CREATE POLICY "costs_modify" ON costs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id = project_id AND pa.user_id = auth_user_id()) OR
    is_admin_or_executive()
  );

-- ============================================================
-- promotional_expenses: 自担当 or 管理者
-- ============================================================
CREATE POLICY "promo_select" ON promotional_expenses FOR SELECT
  USING (user_id = auth_user_id() OR is_dept_manager(department_id) OR is_admin_or_executive());
CREATE POLICY "promo_insert" ON promotional_expenses FOR INSERT
  WITH CHECK (user_id = auth_user_id() OR is_admin_or_executive());
CREATE POLICY "promo_admin" ON promotional_expenses FOR ALL USING (is_admin_or_executive());

-- ============================================================
-- fixed_expenses: 自分の合計のみ（内訳は管理者のみ）
-- ============================================================
CREATE POLICY "fixed_select_own" ON fixed_expenses FOR SELECT
  USING (
    (user_id = auth_user_id() AND is_visible = true) OR
    is_dept_manager(department_id) OR
    is_admin_or_executive()
  );
CREATE POLICY "fixed_admin" ON fixed_expenses FOR ALL USING (is_admin_or_executive());

-- ============================================================
-- targets: 自分 or 部門責任者 or 管理者
-- ============================================================
CREATE POLICY "targets_select" ON targets FOR SELECT
  USING (
    user_id = auth_user_id() OR
    (department_id IS NOT NULL AND is_dept_manager(department_id)) OR
    is_admin_or_executive()
  );
CREATE POLICY "targets_admin" ON targets FOR ALL USING (is_admin_or_executive());
CREATE POLICY "targets_manager" ON targets FOR ALL
  USING (is_dept_manager(department_id) AND target_scope = 'department');

-- ============================================================
-- approval_requests: 申請者 or 承認者 or 管理者
-- ============================================================
CREATE POLICY "approval_select" ON approval_requests FOR SELECT
  USING (
    requester_id = auth_user_id() OR
    approver_id = auth_user_id() OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND is_dept_manager(p.department_id)) OR
    is_admin_or_executive()
  );
CREATE POLICY "approval_insert" ON approval_requests FOR INSERT
  WITH CHECK (requester_id = auth_user_id());
CREATE POLICY "approval_update_approver" ON approval_requests FOR UPDATE
  USING (
    approver_id = auth_user_id() OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND is_dept_manager(p.department_id)) OR
    is_admin_or_executive()
  );

-- ============================================================
-- change_logs: 自案件 or 管理者（削除不可）
-- ============================================================
CREATE POLICY "change_logs_select" ON change_logs FOR SELECT
  USING (
    changed_by = auth_user_id() OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = project_id
        AND (is_dept_manager(p.department_id) OR is_admin_or_executive())
    )) OR
    is_admin_or_executive()
  );
CREATE POLICY "change_logs_insert" ON change_logs FOR INSERT
  WITH CHECK (changed_by = auth_user_id() OR is_admin_or_executive());
-- DELETE は全員禁止（ポリシーなし = 禁止）

-- ============================================================
-- line_notification_settings / logs: 管理者のみ
-- ============================================================
CREATE POLICY "line_settings_admin" ON line_notification_settings FOR ALL
  USING (is_admin_or_executive());
CREATE POLICY "line_settings_select" ON line_notification_settings FOR SELECT
  USING (is_admin_or_executive());

CREATE POLICY "line_logs_admin" ON line_notification_logs FOR ALL
  USING (is_admin_or_executive());

-- ============================================================
-- monthly_closings: 部門責任者は閲覧、経理・経営者は操作
-- ============================================================
CREATE POLICY "closings_select" ON monthly_closings FOR SELECT
  USING (is_dept_manager(department_id) OR is_admin_or_executive());
CREATE POLICY "closings_admin" ON monthly_closings FOR ALL
  USING (is_admin_or_executive());

-- ============================================================
-- prospect_weights: 管理者のみ変更、全員読み取り
-- ============================================================
CREATE POLICY "weights_select" ON prospect_weights FOR SELECT USING (true);
CREATE POLICY "weights_admin" ON prospect_weights FOR ALL USING (is_admin_or_executive());
