'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function completeTask(taskId: string, note: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const now = new Date().toISOString()

  // タスクを完了に更新
  const { data: task } = await supabase
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: now,
      completion_note: note || null,
      updated_at: now,
    })
    .eq('id', taskId)
    .select('customer_id, deal_id, task_type')
    .single()

  if (!task) return

  // action_logsへ履歴保存
  await supabase.from('action_logs').insert({
    customer_id: task.customer_id,
    deal_id: task.deal_id,
    task_id: taskId,
    user_id: user.id,
    action_type: mapTaskTypeToActionType(task.task_type),
    action_detail: `ToDo完了: ${note || ''}`,
    actioned_at: now,
  })

  // customers.last_contact_dateを更新
  if (task.customer_id) {
    const today = new Date().toISOString().split('T')[0]
    await supabase
      .from('customers')
      .update({ last_contact_date: today, updated_at: now })
      .eq('id', task.customer_id)
  }

  revalidatePath('/tasks')
}

function mapTaskTypeToActionType(taskType: string): string {
  const map: Record<string, string> = {
    phone: 'call',
    line_msg: 'line_msg',
    email: 'email',
    meeting: 'meeting',
    document_send: 'document_send',
    contract_followup: 'contract',
    payment_followup: 'payment',
  }
  return map[taskType] ?? 'note'
}
