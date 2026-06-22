'use server'

import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ClosingStatus } from '@/types'

const ClosingSchema = z.object({
  year:         z.coerce.number().int().min(2020).max(2099),
  month:        z.coerce.number().int().min(1).max(12),
  departmentId: z.string().optional().nullable(),
  newStatus:    z.enum(['open', 'temporary', 'final', 'amending', 'amended']),
  closingId:    z.string().uuid().optional().nullable(),
  notes:        z.string().optional(),
})

export async function updateClosingStatus(formData: FormData) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) return { error: '権限がありません' }

  const raw = {
    year:         formData.get('year'),
    month:        formData.get('month'),
    departmentId: formData.get('departmentId') || null,
    newStatus:    formData.get('newStatus'),
    closingId:    formData.get('closingId') || null,
    notes:        formData.get('notes'),
  }

  const parsed = ClosingSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const { year, month, departmentId, newStatus, closingId } = parsed.data
  const supabase = await createClient()

  if (closingId) {
    // 既存レコードを更新
    const { error } = await supabase
      .from('monthly_closings')
      .update({
        status:    newStatus,
        closed_by: user.id,
        closed_at: (['final', 'temporary'] as string[]).includes(newStatus) ? new Date().toISOString() : null,
        notes:     parsed.data.notes ?? null,
      })
      .eq('id', closingId)

    if (error) return { error: error.message }
  } else {
    // 新規作成
    const { error } = await supabase
      .from('monthly_closings')
      .insert({
        closing_year:  year,
        closing_month: month,
        department_id: departmentId ?? null,
        status:        newStatus,
        closed_by:     user.id,
        closed_at:     (['final', 'temporary'] as string[]).includes(newStatus) ? new Date().toISOString() : null,
        notes:         parsed.data.notes ?? null,
      })

    if (error) return { error: error.message }
  }

  // 本締め時：対象月・部門の案件をロック
  if (newStatus === 'final') {
    await lockProjectsForMonth(supabase, year, month, departmentId ?? null)
  }

  // 本締め解除（open/amending）時：ロック解除
  if (newStatus === 'open' || newStatus === 'amending') {
    await unlockProjectsForMonth(supabase, year, month, departmentId ?? null)
  }

  // 監査ログ
  await supabase.from('change_logs').insert({
    target_table: 'monthly_closings',
    target_id:    closingId ?? 'new',
    changed_by:   user.id,
    field_name:   'status',
    new_value:    newStatus,
    reason:       `月次締め操作: ${year}年${month}月 ${departmentId ? '部門' : '全社'}`,
  })

  revalidatePath('/admin/closing')
  return { success: true }
}

async function lockProjectsForMonth(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  year: number,
  month: number,
  departmentId: string | null
) {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  let query = supabase
    .from('projects')
    .update({ is_locked: true })
    .gte('created_at', monthStart)
    .lt('created_at', nextMonth)
    .is('deleted_at', null)

  if (departmentId) {
    query = query.eq('department_id', departmentId)
  }

  await query
}

async function unlockProjectsForMonth(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  year: number,
  month: number,
  departmentId: string | null
) {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  let query = supabase
    .from('projects')
    .update({ is_locked: false })
    .gte('created_at', monthStart)
    .lt('created_at', nextMonth)
    .is('deleted_at', null)

  if (departmentId) {
    query = query.eq('department_id', departmentId)
  }

  await query
}
