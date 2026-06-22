// ============================================================
// LINE Messaging API ユーティリティ
// LINEトークンはサーバーサイドのみで使用（フロントエンドへ渡さない）
// ============================================================

export interface LineNotificationPayload {
  projectId: string
  notificationType: 'application' | 'contract' | 'payment' | 'cancel' | 'important_change'
  triggeredBy: string
  oldStatus?: string
  reason?: string
}

export interface ProjectForNotification {
  id: string
  name: string
  status: string
  sales_amount: number
  cost_planned: number
  cost_confirmed: number
  application_date: string | null
  contract_date: string | null
  payment_date: string | null
  contract_plan_date: string | null
  delivery_plan_date: string | null
  payment_plan_date: string | null
  flow_type: string
  client_name: string | null
  department?: { name: string } | null
  created_by_user?: { full_name: string } | null
}

// ============================================================
// メッセージビルダー
// ============================================================

export function buildApplicationMessage(
  project: ProjectForNotification,
): string {
  const profit = project.sales_amount - project.cost_planned
  const deptName = project.department?.name ?? '—'
  const assignee = project.created_by_user?.full_name ?? '—'

  return [
    '【新規申込のお知らせ】',
    '',
    `部門：${deptName}`,
    `担当者：${assignee}`,
    `案件名：${project.name}`,
    `顧客名：${project.client_name ?? '—'}`,
    `申込売上予定額：${formatAmount(project.sales_amount)}`,
    `申込利益予定額：${formatAmount(profit)}`,
    `申込日：${project.application_date ?? '—'}`,
    `契約予定日：${project.contract_plan_date ?? '—'}`,
    `引渡し・納品予定日：${project.delivery_plan_date ?? '—'}`,
    `入金予定日：${project.payment_plan_date ?? '—'}`,
    `商流区分：${project.flow_type}`,
    '',
    `ダッシュボード：${process.env.NEXT_PUBLIC_APP_URL}/projects/${project.id}`,
  ].join('\n')
}

export function buildContractMessage(
  project: ProjectForNotification,
  personalProgressRate: number,
  deptProgressRate: number,
  companyProgressRate: number,
): string {
  const profit = project.sales_amount - project.cost_planned
  const deptName = project.department?.name ?? '—'
  const assignee = project.created_by_user?.full_name ?? '—'

  return [
    '【新規契約・受注のお知らせ】',
    '',
    `部門：${deptName}`,
    `担当者：${assignee}`,
    `案件名：${project.name}`,
    `顧客名：${project.client_name ?? '—'}`,
    `契約・受注金額：${formatAmount(project.sales_amount)}`,
    `予定利益：${formatAmount(profit)}`,
    `契約日：${project.contract_date ?? '—'}`,
    `引渡し・納品予定日：${project.delivery_plan_date ?? '—'}`,
    `入金予定日：${project.payment_plan_date ?? '—'}`,
    `商流区分：${project.flow_type}`,
    '',
    `今月の担当者利益進捗率：${formatRate(personalProgressRate)}`,
    `今月の部門利益進捗率：${formatRate(deptProgressRate)}`,
    `今月の全社利益進捗率：${formatRate(companyProgressRate)}`,
    '',
    `ダッシュボード：${process.env.NEXT_PUBLIC_APP_URL}/projects/${project.id}`,
  ].join('\n')
}

export function buildPaymentMessage(
  project: ProjectForNotification,
  personalMonthlyRealizedProfit: number,
  personalProgressRate: number,
  contractToPaymentDays: number | null,
): string {
  const realizedProfit = project.sales_amount - project.cost_confirmed
  const assignee = project.created_by_user?.full_name ?? '—'

  return [
    '【入金完了のお知らせ】',
    '',
    `部門：${project.department?.name ?? '—'}`,
    `担当者：${assignee}`,
    `案件名：${project.name}`,
    `入金金額：${formatAmount(project.sales_amount)}`,
    `実現利益：${formatAmount(realizedProfit)}`,
    `入金日：${project.payment_date ?? '—'}`,
    `契約から入金までの日数：${contractToPaymentDays !== null ? `${contractToPaymentDays}日` : '—'}`,
    '',
    `担当者の月間実現利益：${formatAmount(personalMonthlyRealizedProfit)}`,
    `担当者の月間利益進捗率：${formatRate(personalProgressRate)}`,
  ].join('\n')
}

export function buildCancelMessage(
  project: ProjectForNotification,
  oldStatus: string,
  reason: string,
  changedByName: string,
): string {
  const salesImpact = -project.sales_amount
  const profitImpact = -(project.sales_amount - project.cost_planned)
  const jst = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })

  return [
    '⚠️【申込・契約キャンセル通知】',
    '',
    `担当者：${project.created_by_user?.full_name ?? '—'}`,
    `案件名：${project.name}`,
    `変更前ステータス：${oldStatus}`,
    `売上影響額：${formatAmount(salesImpact)}`,
    `利益影響額：${formatAmount(profitImpact)}`,
    `キャンセル理由：${reason || '—'}`,
    `変更者：${changedByName}`,
    `変更日時：${jst}`,
    '',
    `ダッシュボード：${process.env.NEXT_PUBLIC_APP_URL}/projects/${project.id}`,
  ].join('\n')
}

export function buildImportantChangeMessage(
  project: ProjectForNotification,
  fieldName: string,
  oldValue: string,
  newValue: string,
  reason: string,
  changedByName: string,
  monthlySalesImpact: number,
  monthlyProfitImpact: number,
): string {
  const jst = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })

  return [
    '【重要項目変更通知】',
    '',
    `変更者：${changedByName}`,
    `案件名：${project.name}`,
    `変更項目：${fieldName}`,
    `変更前：${oldValue || '—'}`,
    `変更後：${newValue}`,
    `差額：${oldValue && newValue ? formatAmount(Number(newValue) - Number(oldValue)) : '—'}`,
    `変更理由：${reason || '—'}`,
    '',
    `月間売上への影響：${formatAmount(monthlySalesImpact)}`,
    `月間利益への影響：${formatAmount(monthlyProfitImpact)}`,
    `変更日時：${jst}`,
    '',
    `ダッシュボード：${process.env.NEXT_PUBLIC_APP_URL}/projects/${project.id}`,
  ].join('\n')
}

// ============================================================
// LINE Messaging API 送信
// ============================================================

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendLineMessage(
  groupId: string,
  message: string,
): Promise<SendResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not set' }

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: groupId,
        messages: [{ type: 'text', text: message }],
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { success: false, error: `LINE API error ${res.status}: ${body}` }
    }

    const data = await res.json().catch(() => ({}))
    return { success: true, messageId: data.sentMessages?.[0]?.id }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ============================================================
// 指数バックオフ付きリトライ送信
// max_retries=3: 即時 → 1分後 → 5分後
// ============================================================

export async function sendLineMessageWithRetry(
  groupId: string,
  message: string,
  maxRetries = 3,
): Promise<{ result: SendResult; retryCount: number }> {
  const delays = [0, 60_000, 300_000]  // ms
  let retryCount = 0
  let result: SendResult = { success: false }

  for (let i = 0; i < maxRetries; i++) {
    if (i > 0 && delays[i]) {
      await new Promise((r) => setTimeout(r, delays[i]))
    }
    result = await sendLineMessage(groupId, message)
    retryCount = i
    if (result.success) break
  }

  return { result, retryCount }
}

// ============================================================
// 二重送信チェック
// 同じ案件×同じ通知種別でsuccessログがあればスキップ
// ============================================================

export function shouldNotify(
  logs: { notification_type: string; result: string | null }[],
  notificationType: string,
): boolean {
  return !logs.some(
    (l) => l.notification_type === notificationType && l.result === 'success',
  )
}

// ============================================================
// ユーティリティ
// ============================================================

function formatAmount(amount: number): string {
  return `${amount < 0 ? '-' : ''}¥${Math.abs(amount).toLocaleString('ja-JP')}円`
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}
