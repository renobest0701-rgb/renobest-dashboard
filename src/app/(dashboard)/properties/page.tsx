import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PropertiesList } from './PropertiesList'

export const dynamic = 'force-dynamic'

export default async function PropertiesPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: propertiesRaw } = await supabase
    .from('properties')
    .select(`
      id, property_name, property_type, address, price,
      publish_status, sales_status, owner_type, company_project_flag,
      memo, sync_source, assigned_user_id,
      users!properties_assigned_user_id_fkey(full_name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties = (propertiesRaw ?? []).map((p: any) => ({
    ...p,
    users: Array.isArray(p.users) ? (p.users[0] ?? null) : p.users,
  }))

  const stats = {
    total: properties.length,
    active: properties.filter((p) => p.sales_status === 'active').length,
    published: properties.filter((p) => p.publish_status === 'published').length,
    underContract: properties.filter((p) => p.sales_status === 'under_contract').length,
  }

  return <PropertiesList properties={properties} stats={stats} currentUserId={user.id} />
}
