import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { NewProjectForm } from './NewProjectForm'

export default async function NewProjectPage() {
  await requireAuth()
  const supabase = await createClient()

  const { data: departments } = await supabase
    .from('departments')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">新規案件登録</h1>
      <NewProjectForm departments={departments ?? []} />
    </div>
  )
}
