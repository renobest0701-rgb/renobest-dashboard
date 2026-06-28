import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GASから送られるペイロード型
interface CustomerSyncPayload {
  customer_name: string
  phone?: string
  email?: string
  line_name?: string
  language?: string
  customer_type?: string
  rank?: string
  source?: string
  assigned_user_email?: string
  status?: string
  first_contact_status?: string
  last_contact_date?: string
  next_action_date?: string
  memo?: string
  spreadsheet_row_id?: string
  row_number?: number
}

// 重複判定キー生成（phone または email）
function buildExternalId(payload: CustomerSyncPayload): string | null {
  const phone = payload.phone?.replace(/[-\s]/g, '')
  if (phone) return `phone:${phone}`
  if (payload.email) return `email:${payload.email}`
  return null
}

// ToDo自動作成ルール
async function createAutoTasks(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  customerId: string,
  assignedUserId: string | null,
  rank: string,
  firstContactStatus: string,
  lastContactDate: string | null,
  nextActionDate: string | null,
  isNew: boolean
) {
  const today = new Date().toISOString().split('T')[0]
  const tasks: Array<{
    customer_id: string
    assigned_user_id: string | null
    task_title: string
    task_type: string
    priority: string
    due_date: string
    auto_generated: boolean
    auto_rule: string
  }> = []

  // ルール1: 新規顧客かつ未接触 → 初回連絡ToDo
  if (isNew && firstContactStatus === 'not_contacted') {
    tasks.push({
      customer_id: customerId,
      assigned_user_id: assignedUserId,
      task_title: '初回連絡',
      task_type: 'first_contact',
      priority: 'high',
      due_date: today,
      auto_generated: true,
      auto_rule: 'new_customer_not_contacted',
    })
  }

  // ルール2: Aランク → 本日中の電話ToDo
  if (rank === 'a') {
    tasks.push({
      customer_id: customerId,
      assigned_user_id: assignedUserId,
      task_title: '【Aランク】本日電話連絡',
      task_type: 'phone',
      priority: 'high',
      due_date: today,
      auto_generated: true,
      auto_rule: 'rank_a_same_day_call',
    })
  }

  // ルール3: Bランク → 翌日のLINE/メールToDo
  if (rank === 'b' && isNew) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tasks.push({
      customer_id: customerId,
      assigned_user_id: assignedUserId,
      task_title: '【Bランク】LINE/メール送信',
      task_type: 'line_msg',
      priority: 'medium',
      due_date: tomorrow.toISOString().split('T')[0],
      auto_generated: true,
      auto_rule: 'rank_b_next_day_msg',
    })
  }

  // ルール4: 次回予定日が空欄 → 次回設定ToDo
  if (!nextActionDate && !isNew) {
    tasks.push({
      customer_id: customerId,
      assigned_user_id: assignedUserId,
      task_title: '次回予定日を設定',
      task_type: 'set_next_date',
      priority: 'medium',
      due_date: today,
      auto_generated: true,
      auto_rule: 'no_next_action_date',
    })
  }

  // ルール5: 最終接触日から3日以上経過 → 再フォロー
  if (lastContactDate) {
    const last = new Date(lastContactDate)
    const diffDays = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays >= 3 && !isNew) {
      tasks.push({
        customer_id: customerId,
        assigned_user_id: assignedUserId,
        task_title: `再フォロー（最終接触から${diffDays}日経過）`,
        task_type: 'follow_up',
        priority: 'medium',
        due_date: today,
        auto_generated: true,
        auto_rule: 'no_contact_3days',
      })
    }
  }

  if (tasks.length > 0) {
    await supabase.from('tasks').insert(tasks)
  }

  return tasks.length
}

export async function POST(req: NextRequest) {
  // APIシークレット認証
  const authHeader = req.headers.get('authorization')
  const secret = process.env.INTERNAL_API_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: CustomerSyncPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!payload.customer_name) {
    return NextResponse.json({ error: 'customer_name is required' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // 担当者IDを解決（メールアドレスから検索）
  let assignedUserId: string | null = null
  if (payload.assigned_user_email) {
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('email', payload.assigned_user_email)
      .single()
    assignedUserId = userRow?.id ?? null
  }

  // 外部IDで重複判定
  const externalId = buildExternalId(payload)
  let existingCustomerId: string | null = null
  let isNew = true

  if (externalId) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('external_id', externalId)
      .single()
    if (existing) {
      existingCustomerId = existing.id
      isNew = false
    }
  }

  const rank = payload.rank ?? 'c'
  const firstContactStatus = payload.first_contact_status ?? 'not_contacted'

  const customerData = {
    name: payload.customer_name,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    line_name: payload.line_name ?? null,
    language: payload.language ?? 'ja',
    customer_type: payload.customer_type ?? 'individual',
    rank,
    source: payload.source ?? null,
    assigned_user_id: assignedUserId,
    status: payload.status ?? 'active',
    first_contact_status: firstContactStatus,
    last_contact_date: payload.last_contact_date ?? null,
    next_action_date: payload.next_action_date ?? null,
    notes: payload.memo ?? null,
    external_id: externalId,
    spreadsheet_row_id: payload.spreadsheet_row_id ?? null,
    sync_source: 'google_sheets',
    updated_at: new Date().toISOString(),
  }

  let customerId: string
  let syncStatus: 'success' | 'duplicate'

  if (isNew) {
    const { data, error } = await supabase
      .from('customers')
      .insert(customerData)
      .select('id')
      .single()

    if (error) {
      await supabase.from('sync_logs').insert({
        sync_type: 'customer',
        source: 'google_sheets',
        status: 'error',
        payload,
        error_message: error.message,
        row_number: payload.row_number ?? null,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    customerId = data.id
    syncStatus = 'success'
  } else {
    // 既存顧客の更新（名前・メモ以外は上書き）
    customerId = existingCustomerId!
    await supabase
      .from('customers')
      .update(customerData)
      .eq('id', customerId)
    syncStatus = 'duplicate'
  }

  // ToDo自動作成
  const taskCount = await createAutoTasks(
    supabase,
    customerId,
    assignedUserId,
    rank,
    firstContactStatus,
    payload.last_contact_date ?? null,
    payload.next_action_date ?? null,
    isNew
  )

  // 同期ログ記録
  await supabase.from('sync_logs').insert({
    sync_type: 'customer',
    source: 'google_sheets',
    sheet_name: payload.spreadsheet_row_id?.split(':')[0] ?? null,
    status: syncStatus,
    payload,
    result: { customer_id: customerId, tasks_created: taskCount, is_new: isNew },
    row_number: payload.row_number ?? null,
  })

  // 最終同期日時を更新
  await supabase
    .from('google_sync_settings')
    .update({ setting_value: new Date().toISOString() })
    .eq('setting_key', 'last_customer_sync')

  return NextResponse.json({
    success: true,
    customer_id: customerId,
    is_new: isNew,
    tasks_created: taskCount,
    status: syncStatus,
  })
}
