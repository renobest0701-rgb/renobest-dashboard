// ============================================================
// RENOBEST — 共通型定義
// ============================================================

export type Role = 'staff' | 'manager' | 'accounting' | 'executive' | 'non_sales'

export type ProjectStatus =
  | 'new'
  | 'negotiating'
  | 'prospect_b'
  | 'prospect_a'
  | 'application'
  | 'contracted'
  | 'delivered'
  | 'invoiced'
  | 'paid'
  | 'on_hold'
  | 'lost'
  | 'cancelled'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  new:          '新規',
  negotiating:  '商談中',
  prospect_b:   '見込みB',
  prospect_a:   '見込みA',
  application:  '申込',
  contracted:   '契約・受注済',
  delivered:    '引渡し・納品済',
  invoiced:     '請求済',
  paid:         '入金済',
  on_hold:      '保留',
  lost:         '失注・没',
  cancelled:    'キャンセル',
}

export type FlowType =
  | 'direct'
  | 'referral'
  | 'general_contractor'
  | 'realty_mediation'
  | 'seller'
  | 'new_build_consignment'
  | 'vr_consignment'
  | 'joint'
  | 'ad_agency'
  | 'internal'
  | 'other'

export const FLOW_TYPE_LABELS: Record<FlowType, string> = {
  direct:               '直接受注',
  referral:             '紹介受注',
  general_contractor:   '元請経由',
  realty_mediation:     '不動産仲介',
  seller:               '売主',
  new_build_consignment:'新築販売受託',
  vr_consignment:       'VR・制作受託',
  joint:                '共同案件',
  ad_agency:            '広告代理店',
  internal:             '社内',
  other:                'その他',
}

export type ProspectRank = 'a' | 'b' | 'other'

export type SaleType = 'contract' | 'delivered' | 'invoiced' | 'paid'
export type CostType = 'planned' | 'confirmed'
export type TargetPeriod = 'monthly' | 'yearly'
export type TargetScope = 'personal' | 'department' | 'company'
export type ClosingStatus = 'open' | 'temporary' | 'final' | 'amending' | 'amended'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export type PromoCategory =
  | 'portal_ad' | 'sns_ad' | 'email' | 'line_ad'
  | 'referral_fee' | 'travel' | 'photo' | 'production'
  | 'print' | 'entertainment' | 'other'

export const PROMO_CATEGORY_LABELS: Record<PromoCategory, string> = {
  portal_ad:    'ポータル広告',
  sns_ad:       'SNS広告',
  email:        'メール配信',
  line_ad:      'LINE広告',
  referral_fee: '紹介料',
  travel:       '交通費',
  photo:        '撮影費',
  production:   '制作費',
  print:        '印刷・資料費',
  entertainment:'接待・顧客対応費',
  other:        'その他',
}

// ============================================================
// DB エンティティ型
// ============================================================

export interface Department {
  id: string
  name: string
  code: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  auth_user_id: string
  email: string
  full_name: string
  department_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  department?: Department
  user_roles?: UserRole[]
}

export interface Role_ {
  id: string
  name: Role
  label: string
}

export interface UserRole {
  id: string
  user_id: string
  role_id: string
  department_id: string | null
  created_at: string
  role?: Role_
  department?: Department
}

export interface Customer {
  id: string
  name: string
  company_name: string | null
  customer_type: 'individual' | 'corporate'
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Project {
  id: string
  name: string
  department_id: string
  customer_id: string | null
  created_by: string
  status: ProjectStatus
  flow_type: FlowType
  client_name: string | null
  referrer_name: string | null
  contractor_name: string | null
  renobest_role: string | null
  subcontractor: string | null
  billing_party: string | null
  payment_source: string | null
  payment_dest: string | null
  referral_fee: number
  outsource_fee: number
  profit_share: string | null
  echo_date: string | null
  first_meeting_date: string | null
  application_date: string | null
  contract_plan_date: string | null
  contract_date: string | null
  delivery_plan_date: string | null
  delivery_date: string | null
  invoice_plan_date: string | null
  invoice_date: string | null
  payment_plan_date: string | null
  payment_date: string | null
  sales_amount: number
  cost_planned: number
  cost_confirmed: number
  prospect_rank: ProspectRank
  customer_memo: string | null
  negotiation_memo: string | null
  next_action_date: string | null
  comment: string | null
  is_locked: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  department?: Department
  customer?: Customer
  created_by_user?: User
  assignments?: ProjectAssignment[]
}

export interface ProjectAssignment {
  id: string
  project_id: string
  user_id: string
  assignment_role: 'main' | 'sub'
  commission_rate: number
  created_at: string
  user?: User
}

export interface Target {
  id: string
  user_id: string | null
  department_id: string | null
  target_scope: TargetScope
  target_period: TargetPeriod
  target_year: number
  target_month: number | null
  sales_target: number
  profit_target: number
  created_at: string
  updated_at: string
}

export interface ProspectWeight {
  id: string
  rank: ProspectRank
  weight: number
  updated_by: string | null
  updated_at: string
}

// ============================================================
// 計算結果型
// ============================================================

export interface PersonalMetrics {
  // 売上
  salesTarget: number
  contractedSales: number
  deliveredSales: number
  paidSales: number

  // 利益
  profitTarget: number
  contractProfit: number
  realizedProfit: number
  prospectProfit: number
  weightedProspectProfit: number

  // 経費
  promotionalExpenses: number
  fixedExpensesBurden: number

  // 着地予測
  landingForecast: number
  progressRateSales: number       // 0〜1
  progressRateProfit: number      // 0〜1
  landingAchievementRate: number  // 0〜1
  profitShortfall: number         // マイナス=不足

  // 入金待ち
  pendingPaymentCount: number
  pendingPaymentSales: number
  pendingPaymentProfit: number
  overduePaymentCount: number
}
