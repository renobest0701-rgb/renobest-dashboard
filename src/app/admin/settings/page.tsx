import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { SettingsEditor } from './SettingsEditor'

export default async function SettingsPage() {
  const user = await requireAuth()
  if (!user.roles.some((r) => ['accounting', 'executive'].includes(r))) redirect('/')

  const supabase = await createServiceClient()
  const [{ data }, { data: weightsData }] = await Promise.all([
    supabase.from('system_settings').select('value').eq('key', 'project_fields').single(),
    supabase.from('prospect_weights').select('rank, weight').order('rank'),
  ])

  const projectFields = (data?.value ?? {}) as Record<string, { label: string; visible: boolean; required: boolean }>
  const prospectWeights = (weightsData ?? []) as { rank: string; weight: number }[]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        <p className="text-sm text-gray-500 mt-1">システム全体の設定を管理します</p>
      </div>
      <SettingsEditor projectFields={projectFields} prospectWeights={prospectWeights} />
    </div>
  )
}
