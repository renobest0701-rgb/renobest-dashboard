'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { ProjectStatus } from '@/types'

// ============================================================
// スキーマ定義
// ============================================================

const ProjectSchema = z.object({
  name:              z.string().min(1, '案件名は必須です').max(200),
  department_id:     z.string().uuid('部門を選択してください'),
  customer_name:     z.string().optional(),
  flow_type:         z.string(),
  client_name:       z.string().optional(),
  sales_amount:      z.coerce.number().int().min(0).default(0),
  cost_planned:      z.coerce.number().int().min(0).default(0),
  prospect_rank:     z.enum(['a','b','other']).default('b'),
  echo_date:         z.string().optional(),
  first_meeting_date:z.string().optional(),
  application_date:  z.string().optional(),
  contract_plan_date:z.string().optional(),
  contract_date:     z.string().optional(),
  delivery_plan_date:z.string().optional(),
  payment_plan_date: z.string().optional(),
  customer_memo:     z.string().optional(),
  negotiation_memo:  z.string().optional(),
  comment:           z.string().optional(),
})

// ============================================================
// 案件新規登録
// ============================================================
export async function createProject(formData: FormData) {
  const user = await requireAuth()
  const supabase = await createClient()

  const raw = Object.fromEntries(formData)
  const parsed = ProjectSchema.safeParse(raw)

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' }
  }

  const { customer_name, ...projectData } = parsed.data

  // 顧客登録（名前があれば作成）
  let customerId: string | null = null
  if (customer_name?.trim()) {
    const { data: customer } = await supabase
      .from('customers')
      .insert({ name: customer_name.trim(), created_by: user.id })
      .select('id')
      .single()
    customerId = customer?.id ?? null
  }

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      ...projectData,
      customer_id: customerId,
      created_by: user.id,
      status: 'new',
    })
    .select('id')
    .single()

  if (error || !project) {
    return { error: '案件の登録に失敗しました: ' + error?.message }
  }

  // 担当者として自動アサイン
  await supabase.from('project_assignments').insert({
    project_id: project.id,
    user_id: user.id,
    assignment_role: 'main',
    commission_rate: 100,
  })

  // 変更ログ
  await supabase.from('change_logs').insert({
    target_table: 'projects',
    target_id: project.id,
    project_id: project.id,
    changed_by: user.id,
    field_name: 'status',
    old_value: null,
    new_value: 'new',
    reason: '案件新規登録',
  })

  revalidatePath('/projects')
  redirect(`/projects/${project.id}`)
}

// ============================================================
// ステータス変更（LINE通知トリガーを含む）
// ============================================================

const STATUSES_REQUIRING_APPROVAL: ProjectStatus[] = [
  'cancelled',
]

export async function changeProjectStatus(
  projectId: string,
  newStatus: ProjectStatus,
  reason?: string
) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, status, name, department_id, is_locked, sales_amount, created_by')
    .eq('id', projectId)
    .single()

  if (!project) return { error: '案件が見つかりません' }
  if (project.is_locked) return { error: 'この案件は月次締め済みです。変更申請が必要です。' }

  const oldStatus = project.status as ProjectStatus

  // キャンセルは承認必須
  if (newStatus === 'cancelled' && oldStatus !== 'new' && oldStatus !== 'lost') {
    await supabase.from('approval_requests').insert({
      project_id: projectId,
      requester_id: user.id,
      field_name: 'status',
      old_value: oldStatus,
      new_value: newStatus,
      reason: reason ?? 'キャンセル申請',
    })
    revalidatePath(`/projects/${projectId}`)
    return { pending: true, message: '承認申請を送信しました' }
  }

  // ステータス更新
  await supabase
    .from('projects')
    .update({ status: newStatus })
    .eq('id', projectId)

  // ステータス履歴
  await supabase.from('project_status_histories').insert({
    project_id: projectId,
    changed_by: user.id,
    old_status: oldStatus,
    new_status: newStatus,
    notes: reason,
  })

  // 変更ログ
  await supabase.from('change_logs').insert({
    target_table: 'projects',
    target_id: projectId,
    project_id: projectId,
    changed_by: user.id,
    field_name: 'status',
    old_value: oldStatus,
    new_value: newStatus,
    reason: reason,
  })

  // LINE通知（申込・契約・入金済・キャンセル）
  if (['application','contracted','paid'].includes(newStatus)) {
    // 通知はRoute Handlerへ委譲（非同期）
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        notificationType: newStatus === 'application' ? 'application'
          : newStatus === 'contracted' ? 'contract'
          : 'payment',
        triggeredBy: user.id,
      }),
    }).catch(() => {})  // 通知失敗は案件更新をブロックしない
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  revalidatePath('/personal')

  return { success: true }
}

// ============================================================
// 案件更新（自由変更項目）
// ============================================================
export async function updateProjectFreeFields(
  projectId: string,
  data: {
    customer_memo?: string
    negotiation_memo?: string
    next_action_date?: string
    comment?: string
  }
) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from('projects')
    .update(data)
    .eq('id', projectId)
    .not('is_locked', 'eq', true)

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

// ============================================================
// 重要項目の変更申請
// ============================================================
export async function requestImportantChange(
  projectId: string,
  fieldName: string,
  oldValue: string,
  newValue: string,
  reason: string
) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase.from('approval_requests').insert({
    project_id: projectId,
    requester_id: user.id,
    field_name: fieldName,
    old_value: oldValue,
    new_value: newValue,
    reason,
  })

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}
