'use server'

import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const PaymentSchema = z.object({
  projectId: z.string().uuid(),
  paymentDate: z.string().min(1),
  actualAmount: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive().optional()
  ),
  finalCost: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).optional()
  ),
  memo: z.string().max(1000).optional(),
})

export async function registerPayment(formData: FormData) {
  const user = await requireAuth()
  const raw = Object.fromEntries(formData)

  const parsed = PaymentSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? '入力値が不正です')
  }

  const { projectId, paymentDate, actualAmount, finalCost, memo } = parsed.data
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('status, sales_amount, cost_confirmed, cost_planned')
    .eq('id', projectId)
    .is('deleted_at', null)
    .single()

  if (!project || project.status !== 'delivered') {
    throw new Error('この案件は入金登録できません')
  }

  const salesAmount = actualAmount ?? project.sales_amount
  const costConfirmed = finalCost ?? project.cost_confirmed ?? project.cost_planned

  const { error } = await supabase
    .from('projects')
    .update({
      status: 'paid',
      payment_date: paymentDate,
      sales_amount: salesAmount,
      cost_confirmed: costConfirmed,
      memo: memo ? `${project as any}${memo}` : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)

  if (error) throw new Error(error.message)

  // change_log記録
  await supabase.from('change_logs').insert({
    project_id: projectId,
    changed_by: user.id,
    field_name: 'status',
    old_value: 'delivered',
    new_value: 'paid',
    reason: `入金登録: 入金日=${paymentDate}`,
  })

  // LINE通知（fire-and-forget）
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  fetch(`${appUrl}/api/line/notify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
    },
    body: JSON.stringify({
      projectId,
      notificationType: 'payment',
      triggeredBy: user.id,
    }),
  }).catch(() => {})

  redirect(`/projects/${projectId}?msg=payment_registered`)
}
