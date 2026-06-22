'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, isAdminOrExecutive, isDeptManager } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const TargetSchema = z.object({
  id:           z.string().optional(),
  scope:        z.enum(['personal', 'department', 'company']),
  entity_id:    z.string().optional(),
  period:       z.enum(['monthly', 'yearly']),
  month:        z.coerce.number().int().min(1).max(12).optional(),
  year:         z.coerce.number().int().min(2020).max(2099),
  sales_target: z.coerce.number().int().min(0),
  profit_target:z.coerce.number().int().min(0),
})

export async function saveTarget(formData: FormData) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user) && !isDeptManager(user)) {
    return { error: '権限がありません' }
  }

  const raw = Object.fromEntries(formData)
  // 空文字をundefinedに変換
  if (!raw.month) delete raw.month
  if (!raw.entity_id || raw.entity_id === '') delete raw.entity_id

  const parsed = TargetSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message }
  }

  const { id, scope, entity_id, period, month, year, sales_target, profit_target } = parsed.data

  const supabase = await createClient()

  const payload = {
    target_scope:   scope,
    target_period:  period,
    target_year:    year,
    target_month:   month ?? null,
    sales_target,
    profit_target,
    user_id:        scope === 'personal' ? (entity_id ?? null) : null,
    department_id:  scope === 'department' ? (entity_id ?? null) : null,
  }

  if (id) {
    await supabase.from('targets').update(payload).eq('id', id)
  } else {
    await supabase.from('targets').insert(payload)
  }

  revalidatePath('/admin/targets')
  redirect(`/admin/targets?year=${year}&msg=saved`)
}
