import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CustomerDetail } from './CustomerDetail'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireAuth()
  const supabase = await createClient()

  const { data: customerRaw } = await supabase
    .from('customers')
    .select(`
      id, name, phone, email, line_name, language,
      customer_type, rank, source, status, first_contact_status,
      last_contact_date, next_action_date, notes, sync_source,
      assigned_user_id, created_at, updated_at,
      users!customers_assigned_user_id_fkey(id, full_name, email)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!customerRaw) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = customerRaw as any
  const customer = {
    ...c,
    users: Array.isArray(c.users) ? (c.users[0] ?? null) : c.users,
  }

  // 関連ToDo
  const { data: tasksRaw } = await supabase
    .from('tasks')
    .select('id, task_title, task_type, priority, due_date, status, auto_generated, created_at')
    .eq('customer_id', id)
    .order('due_date', { ascending: true })

  // 行動履歴
  const { data: logsRaw } = await supabase
    .from('action_logs')
    .select(`
      id, action_type, action_detail, result, actioned_at,
      users!action_logs_user_id_fkey(full_name)
    `)
    .eq('customer_id', id)
    .order('actioned_at', { ascending: false })
    .limit(30)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = (logsRaw ?? []).map((l: any) => ({
    ...l,
    users: Array.isArray(l.users) ? (l.users[0] ?? null) : l.users,
  }))

  return (
    <CustomerDetail
      customer={customer}
      tasks={tasksRaw ?? []}
      logs={logs}
    />
  )
}
