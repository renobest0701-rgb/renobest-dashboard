import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  buildApplicationMessage,
  buildContractMessage,
  buildPaymentMessage,
  buildCancelMessage,
  buildImportantChangeMessage,
  sendLineMessageWithRetry,
  shouldNotify,
  type ProjectForNotification,
} from '@/lib/line'
import { calcProgressRate, daysBetween } from '@/lib/calculations'

// 内部APIのシークレットキー（環境変数で管理）
function verifyInternalSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-internal-secret')
  const expected = process.env.INTERNAL_API_SECRET
  if (!expected) return true  // 未設定の場合は開発環境として許可
  return secret === expected
}

export async function POST(request: NextRequest) {
  if (!verifyInternalSecret(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    projectId: string
    notificationType: string
    triggeredBy: string
    oldStatus?: string
    reason?: string
    changedByName?: string
    fieldName?: string
    oldValue?: string
    newValue?: string
    monthlySalesImpact?: number
    monthlyProfitImpact?: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { projectId, notificationType, triggeredBy } = body

  if (!projectId || !notificationType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // 案件情報取得
  const { data: project } = await supabase
    .from('projects')
    .select(`
      *,
      department:departments(name),
      created_by_user:users!projects_created_by_fkey(full_name)
    `)
    .eq('id', projectId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // 二重送信チェック
  const { data: existingLogs } = await supabase
    .from('line_notification_logs')
    .select('notification_type, result')
    .eq('project_id', projectId)
    .eq('notification_type', notificationType)

  if (!shouldNotify(existingLogs ?? [], notificationType)) {
    return NextResponse.json({ skipped: true, reason: 'duplicate' })
  }

  // 通知設定取得（アクティブな設定のみ）
  const { data: settings } = await supabase
    .from('line_notification_settings')
    .select('*')
    .eq('notification_type', notificationType)
    .eq('is_active', true)

  if (!settings || settings.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no_active_settings' })
  }

  // ============================================================
  // メッセージ構築（通知種別ごと）
  // ============================================================
  const p = project as unknown as ProjectForNotification

  let message = ''

  if (notificationType === 'application') {
    message = buildApplicationMessage(p)

  } else if (notificationType === 'contract') {
    // 進捗率を計算
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`

    // 個人進捗率
    const { data: personalTarget } = await supabase
      .from('targets')
      .select('profit_target')
      .eq('user_id', project.created_by)
      .eq('target_period', 'monthly')
      .eq('target_year', year)
      .eq('target_month', month)
      .single()

    const { data: personalProjects } = await supabase
      .from('projects')
      .select('status, sales_amount, cost_confirmed')
      .eq('created_by', project.created_by)
      .eq('status', 'paid')
      .is('deleted_at', null)

    const personalRealizedProfit = (personalProjects ?? []).reduce(
      (s, p) => s + p.sales_amount - p.cost_confirmed, 0
    )
    const personalRate = calcProgressRate(
      personalRealizedProfit,
      personalTarget?.profit_target ?? 0
    )

    // 部門進捗率
    const { data: deptTarget } = await supabase
      .from('targets')
      .select('profit_target')
      .eq('department_id', project.department_id)
      .eq('target_period', 'monthly')
      .eq('target_year', year)
      .eq('target_month', month)
      .single()

    const { data: deptProjects } = await supabase
      .from('projects')
      .select('status, sales_amount, cost_confirmed')
      .eq('department_id', project.department_id)
      .eq('status', 'paid')
      .is('deleted_at', null)

    const deptRealizedProfit = (deptProjects ?? []).reduce(
      (s, p) => s + p.sales_amount - p.cost_confirmed, 0
    )
    const deptRate = calcProgressRate(
      deptRealizedProfit,
      deptTarget?.profit_target ?? 0
    )

    // 全社進捗率
    const { data: companyTarget } = await supabase
      .from('targets')
      .select('profit_target')
      .eq('target_scope', 'company')
      .eq('target_period', 'monthly')
      .eq('target_year', year)
      .eq('target_month', month)
      .is('user_id', null)
      .is('department_id', null)
      .single()

    const { data: allPaidProjects } = await supabase
      .from('projects')
      .select('sales_amount, cost_confirmed')
      .eq('status', 'paid')
      .is('deleted_at', null)

    const companyRealizedProfit = (allPaidProjects ?? []).reduce(
      (s, p) => s + p.sales_amount - p.cost_confirmed, 0
    )
    const companyRate = calcProgressRate(
      companyRealizedProfit,
      companyTarget?.profit_target ?? 0
    )

    message = buildContractMessage(p, personalRate, deptRate, companyRate)

  } else if (notificationType === 'payment') {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    // 個人今月の実現利益
    const { data: personalPaidProjects } = await supabase
      .from('projects')
      .select('status, sales_amount, cost_confirmed, payment_date')
      .eq('created_by', project.created_by)
      .eq('status', 'paid')
      .is('deleted_at', null)

    const personalMonthlyRealized = (personalPaidProjects ?? [])
      .filter((p) => {
        if (!p.payment_date) return false
        const d = new Date(p.payment_date)
        return d.getFullYear() === year && d.getMonth() + 1 === month
      })
      .reduce((s, p) => s + p.sales_amount - p.cost_confirmed, 0)

    const { data: personalTarget } = await supabase
      .from('targets')
      .select('profit_target')
      .eq('user_id', project.created_by)
      .eq('target_period', 'monthly')
      .eq('target_year', year)
      .eq('target_month', month)
      .single()

    const personalRate = calcProgressRate(
      personalMonthlyRealized,
      personalTarget?.profit_target ?? 0
    )

    const contractToPaymentDays = daysBetween(
      project.contract_date,
      project.payment_date
    )

    message = buildPaymentMessage(
      p,
      personalMonthlyRealized,
      personalRate,
      contractToPaymentDays
    )

  } else if (notificationType === 'cancel') {
    message = buildCancelMessage(
      p,
      body.oldStatus ?? '—',
      body.reason ?? '—',
      body.changedByName ?? '—'
    )

  } else if (notificationType === 'important_change') {
    message = buildImportantChangeMessage(
      p,
      body.fieldName ?? '—',
      body.oldValue ?? '—',
      body.newValue ?? '—',
      body.reason ?? '—',
      body.changedByName ?? '—',
      body.monthlySalesImpact ?? 0,
      body.monthlyProfitImpact ?? 0
    )

  } else {
    return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })
  }

  // ============================================================
  // 各送信先へ送信
  // ============================================================
  const results: {
    target: string
    success: boolean
    retryCount: number
    messageId?: string
    error?: string
  }[] = []

  for (const setting of settings) {
    if (!setting.line_group_id) continue

    // ログ作成（pending状態）
    const { data: log } = await supabase
      .from('line_notification_logs')
      .insert({
        project_id: projectId,
        notification_type: notificationType,
        send_target: setting.target_type,
        result: 'pending',
        retry_count: 0,
      })
      .select('id')
      .single()

    // 送信（指数バックオフリトライ）
    const { result, retryCount } = await sendLineMessageWithRetry(
      setting.line_group_id,
      message,
      3
    )

    // ログ更新
    if (log?.id) {
      await supabase
        .from('line_notification_logs')
        .update({
          result: result.success ? 'success' : 'failed',
          sent_at: result.success ? new Date().toISOString() : null,
          line_message_id: result.messageId ?? null,
          error_message: result.error ?? null,
          retry_count: retryCount,
        })
        .eq('id', log.id)
    }

    results.push({
      target: setting.target_type,
      success: result.success,
      retryCount,
      messageId: result.messageId,
      error: result.error,
    })
  }

  const anySuccess = results.some((r) => r.success)
  return NextResponse.json({
    results,
    anySuccess,
    message: anySuccess ? 'Notification sent' : 'All notifications failed',
  })
}

// ============================================================
// 再送エンドポイント（管理者から手動再送）
// ============================================================
export async function PATCH(request: NextRequest) {
  if (!verifyInternalSecret(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { logId } = await request.json()
  if (!logId) return NextResponse.json({ error: 'Missing logId' }, { status: 400 })

  const supabase = await createServiceClient()

  const { data: log } = await supabase
    .from('line_notification_logs')
    .select('*, project:projects(*, department:departments(name), created_by_user:users!projects_created_by_fkey(full_name))')
    .eq('id', logId)
    .single()

  if (!log) return NextResponse.json({ error: 'Log not found' }, { status: 404 })

  // 送信先設定を再取得
  const { data: settings } = await supabase
    .from('line_notification_settings')
    .select('*')
    .eq('notification_type', log.notification_type)
    .eq('target_type', log.send_target)
    .eq('is_active', true)
    .single()

  if (!settings?.line_group_id) {
    return NextResponse.json({ error: 'No active setting for this target' }, { status: 404 })
  }

  // メッセージ再構築（applicationのみ対応、他は通常フローから呼び出す）
  const project = log.project as unknown as ProjectForNotification
  let message = ''
  if (log.notification_type === 'application') {
    message = buildApplicationMessage(project)
  } else if (log.notification_type === 'contract') {
    message = buildContractMessage(project, 0, 0, 0)
  } else if (log.notification_type === 'payment') {
    message = buildPaymentMessage(project, 0, 0, null)
  } else {
    return NextResponse.json({ error: 'Resend not supported for this type' }, { status: 400 })
  }

  const { result, retryCount } = await sendLineMessageWithRetry(settings.line_group_id, message, 1)

  await supabase
    .from('line_notification_logs')
    .update({
      result: result.success ? 'success' : 'failed',
      sent_at: result.success ? new Date().toISOString() : null,
      line_message_id: result.messageId ?? null,
      error_message: result.error ?? null,
      retry_count: (log.retry_count ?? 0) + 1,
    })
    .eq('id', logId)

  return NextResponse.json({ success: result.success, error: result.error })
}
