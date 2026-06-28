import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { NewCustomerForm } from './NewCustomerForm'

export const dynamic = 'force-dynamic'

export default async function NewCustomerPage() {
  await requireAuth()
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email')
    .order('full_name')

  return <NewCustomerForm users={users ?? []} />
}
