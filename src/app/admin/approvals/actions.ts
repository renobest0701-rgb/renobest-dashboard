'use server'

import { requireAuth, isAdminOrExecutive, isDeptManager } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const ApproveSchema = z.object({
  requestId: z.string().uuid(),
  projectId: z.string().uuid(),
  fieldName: z.string(),
  newValue:  z.string(),
})

const RejectSchema = z.object({
  requestId:       z.string().uuid(),
  rejectionReason: z.string().min(1, '却下理由は必須です'),
})

export async function approveRequest(formData: FormData) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user) && !isDeptManager(user)) {
    return { error: '権限がありません' }
  }

  const parsed = ApproveSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const { requestId, projectId, fieldName, newValue } = parsed.data
  const supabase = await createClient()

  // 申請を承認済みに更新
  const { error: updateErr } = await supabase
    .from('approval_requests')
    .update({
      status:      'approved',
      approver_id: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (updateErr) return { error: updateErr.message }

  // 案件に変更を反映
  const updateData: Record<string, unknown> = {}

  if (fieldName === 'status') {
    updateData.status = newValue
    // ステータス履歴も記録
    const { data: req } = await supabase
      .from('approval_requests')
      .select('old_value, new_value, reason')
      .eq('id', requestId)
      .single()
    await supabase.from('project_status_histories').insert({
      project_id: projectId,
      changed_by: user.id,
      old_status: req?.old_value ?? '',
      new_status: newValue,
      notes: `承認による変更: ${req?.reason ?? ''}`,
    })
  } else {
    const numericFields = ['sales_amount', 'cost_planned', 'cost_confirmed']
    updateData[fieldName] = numericFields.includes(fieldName) ? Number(newValue) : newValue
  }

  await supabase.from('projects').update(updateData).eq('id', projectId)

  // 監査ログ
  await supabase.from('change_logs').insert({
    target_table: 'projects',
    target_id:    projectId,
    project_id:   projectId,
    changed_by:   user.id,
    field_name:   fieldName,
    new_value:    newValue,
    reason:       `承認ワークフローにより変更 (申請ID: ${requestId})`,
  })

  // キャンセル通知
  if (fieldName === 'status' && newValue === 'cancelled') {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
      },
      body: JSON.stringify({
        projectId,
        notificationType: 'cancel',
        triggeredBy: user.id,
        changedByName: user.fullName,
      }),
    }).catch(() => {})
  }

  revalidatePath('/admin/approvals')
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function rejectRequest(formData: FormData) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user) && !isDeptManager(user)) {
    return { error: '権限がありません' }
  }

  const parsed = RejectSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const { requestId, rejectionReason } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase
    .from('approval_requests')
    .update({
      status:           'rejected',
      approver_id:      user.id,
      approved_at:      new Date().toISOString(),
      rejection_reason: rejectionReason,
    })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  revalidatePath('/admin/approvals')
  return { success: true }
}

export async function withdrawRequest(requestId: string) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from('approval_requests')
    .update({ status: 'withdrawn' })
    .eq('id', requestId)
    .eq('requester_id', user.id)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  revalidatePath('/admin/approvals')
  return { success: true }
}
