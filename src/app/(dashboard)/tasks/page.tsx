import { requireAuth, isAdminOrExecutive, isDeptManager } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TaskBoard } from './TaskBoard'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const user = await requireAuth()
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  let taskQuery = supabase
    .from('tasks')
    .select(`
      id, task_title, task_type, priority, due_date, status,
      auto_generated, auto_rule, completed_at, completion_note,
      customer_id, deal_id, assigned_user_id,
      customers(id, name, rank),
      users!tasks_assigned_user_id_fkey(full_name)
    `)
    .neq('status', 'completed')
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true })

  // 管理者・役員は全件、マネージャーは部門、一般は自分のタスクのみ
  if (!isAdminOrExecutive(user) && !isDeptManager(user)) {
    taskQuery = taskQuery.eq('assigned_user_id', user.id)
  }

  const { data: tasksRaw } = await taskQuery

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = (tasksRaw ?? []).map((t: any) => ({
    ...t,
    customers: Array.isArray(t.customers) ? (t.customers[0] ?? null) : t.customers,
    users: Array.isArray(t.users) ? (t.users[0] ?? null) : t.users,
  }))

  const todayTasks = all.filter((t) => t.due_date === today)
  const overdueTasks = all.filter((t) => t.due_date && t.due_date < today)
  const upcomingTasks = all.filter((t) => !t.due_date || t.due_date > today)

  return (
    <TaskBoard
      todayTasks={todayTasks}
      overdueTasks={overdueTasks}
      upcomingTasks={upcomingTasks}
      currentUserId={user.id}
    />
  )
}
