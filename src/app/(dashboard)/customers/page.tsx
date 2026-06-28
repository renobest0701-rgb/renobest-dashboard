import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CustomerList } from './CustomerList'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: customersRaw } = await supabase
    .from('customers')
    .select(`
      id, name, phone, email, line_name, rank, source,
      customer_type, status, first_contact_status,
      last_contact_date, next_action_date, notes, sync_source,
      assigned_user_id,
      users!customers_assigned_user_id_fkey(full_name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // Supabaseはリレーションを配列で返すため正規化
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customers = (customersRaw ?? []).map((c: any) => ({
    ...c,
    users: Array.isArray(c.users) ? (c.users[0] ?? null) : c.users,
  }))

  // サマリー集計
  const all = customers ?? []
  const today = new Date().toISOString().split('T')[0]
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const stats = {
    rankA: all.filter((c) => c.rank === 'a').length,
    noContact3Days: all.filter(
      (c) => c.last_contact_date && c.last_contact_date <= threeDaysAgo
    ).length,
    notContacted: all.filter((c) => c.first_contact_status === 'not_contacted').length,
    noNextDate: all.filter((c) => !c.next_action_date).length,
    total: all.length,
  }

  return <CustomerList customers={all} stats={stats} currentUserId={user.id} />
}
