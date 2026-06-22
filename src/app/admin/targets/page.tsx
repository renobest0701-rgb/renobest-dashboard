import { requireAuth, isAdminOrExecutive, isDeptManager } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TargetEditor } from './TargetEditor'
import { TrendingUp } from 'lucide-react'

export default async function TargetsPage() {
  const authUser = await requireAuth()

  const isExec = isAdminOrExecutive(authUser)
  const isMgr = authUser.roles.includes('manager')

  if (!isExec && !isMgr) redirect('/personal')

  const supabase = await createServiceClient()
  const currentYear = new Date().getFullYear()

  const [{ data: departments }, { data: users }, { data: targets }] = await Promise.all([
    supabase.from('departments').select('id, code, name').eq('is_active', true).order('sort_order'),
    supabase.from('users').select('id, full_name, department_id').eq('is_active', true).is('deleted_at', null).order('full_name'),
    supabase.from('targets').select('*').eq('target_year', currentYear),
  ])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">目標設定</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            全社・部門・個人の売上・利益目標を設定します
          </p>
        </div>
      </div>

      <TargetEditor
        year={currentYear}
        departments={departments ?? []}
        users={users ?? []}
        targets={(targets ?? []) as any}
        isExecutive={isExec}
        myDepartmentId={authUser.departmentId}
      />
    </div>
  )
}