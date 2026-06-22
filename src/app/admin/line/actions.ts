'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const LineSettingSchema = z.object({
  name:              z.string().min(1).max(100),
  notification_type: z.enum(['application','contract','payment','cancel','important_change']),
  target_type:       z.enum(['company_group','department_group','executive','assignee','admin']),
  department_id:     z.string().optional(),
  line_group_id:     z.string().min(1),
})

export async function saveLineSettings(formData: FormData) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) return { error: '権限がありません' }

  const raw = Object.fromEntries(formData)
  if (!raw.department_id || raw.department_id === '') delete raw.department_id

  const parsed = LineSettingSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const supabase = await createClient()
  const { department_id, ...rest } = parsed.data

  await supabase.from('line_notification_settings').insert({
    ...rest,
    department_id: department_id ?? null,
    is_active: true,
  })

  revalidatePath('/admin/line')
  redirect('/admin/line?msg=saved')
}

export async function deleteLineSetting(formData: FormData) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) return { error: '権限がありません' }

  const id = formData.get('id') as string
  const supabase = await createClient()
  await supabase.from('line_notification_settings').delete().eq('id', id)

  revalidatePath('/admin/line')
  redirect('/admin/line?msg=deleted')
}

export async function toggleLineSetting(formData: FormData) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) return { error: '権限がありません' }

  const id = formData.get('id') as string
  const isActive = formData.get('is_active') === 'true'
  const supabase = await createClient()

  await supabase
    .from('line_notification_settings')
    .update({ is_active: isActive })
    .eq('id', id)

  revalidatePath('/admin/line')
  redirect('/admin/line')
}

export async function resendNotification(logId: string) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) return { error: '権限がありません' }

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
    },
    body: JSON.stringify({ logId }),
  })

  const data = await res.json()
  revalidatePath('/admin/line/logs')
  return data
}
