'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const PromoSchema = z.object({
  department_id:  z.string().uuid(),
  user_id:        z.string().optional(),
  category:       z.string(),
  amount:         z.coerce.number().int().min(0),
  description:    z.string().optional(),
  expense_month:  z.string(),
})

const FixedSchema = z.object({
  department_id:   z.string().uuid(),
  user_id:         z.string().optional(),
  allocation_type: z.enum(['direct', 'equal_split']),
  amount:          z.coerce.number().int().min(0),
  is_visible:      z.string().transform((v) => v === 'true'),
  expense_month:   z.string(),
})

function redirectBack(formData: FormData, msg = 'saved') {
  const dept = formData.get('dept') as string | null
  const year = formData.get('year') as string | null
  const month = formData.get('month') as string | null
  const qs = new URLSearchParams({
    ...(dept ? { dept } : {}),
    ...(year ? { year } : {}),
    ...(month ? { month } : {}),
    msg,
  })
  redirect(`/admin/expenses?${qs}`)
}

export async function savePromoExpense(formData: FormData) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) return { error: '権限がありません' }

  const raw = Object.fromEntries(formData)
  if (!raw.user_id || raw.user_id === '') delete raw.user_id

  const parsed = PromoSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const { user_id, ...rest } = parsed.data
  const supabase = await createClient()
  await supabase.from('promotional_expenses').insert({
    ...rest,
    user_id: user_id ?? null,
  })

  redirectBack(formData)
}

export async function deletePromoExpense(formData: FormData) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) return { error: '権限がありません' }

  const id = formData.get('id') as string
  const supabase = await createClient()
  await supabase.from('promotional_expenses').delete().eq('id', id)

  redirectBack(formData)
}

export async function saveFixedExpense(formData: FormData) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) return { error: '権限がありません' }

  const raw = Object.fromEntries(formData)
  if (!raw.user_id || raw.user_id === '') delete raw.user_id

  const parsed = FixedSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const { user_id, ...rest } = parsed.data
  const supabase = await createClient()
  await supabase.from('fixed_expenses').insert({
    ...rest,
    user_id: user_id ?? null,
  })

  redirectBack(formData)
}

export async function deleteFixedExpense(formData: FormData) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) return { error: '権限がありません' }

  const id = formData.get('id') as string
  const supabase = await createClient()
  await supabase.from('fixed_expenses').delete().eq('id', id)

  redirectBack(formData)
}
